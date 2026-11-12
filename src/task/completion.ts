/**
 * Creates a bounded-concurrency async task queue with completion tracking.
 *
 * Tasks are dequeued and executed up to `threadCount` concurrently.
 * Once a running task finishes, the next queued task starts. The
 * `completion` promise resolves only when every enqueued task has finished.
 *
 * Every value passed to `add` settles exactly once, even when it is not a
 * promise-returning function: a plain value or a synchronous return counts as an
 * already-settled task, and a synchronous throw is captured as a rejected task.
 * Either way the slot is released and `completion()` waits for it (see
 * {@link startTask}).
 *
 * @param threadCount - Maximum number of tasks to run in parallel. Defaults to 1.
 * @returns An object with `add` for enqueuing tasks and `completion` for
 *          awaiting the finish of all work.
 *
 * @example
 *   const { add, completion } = taskCompletion(4);
 *   add(() => fetchSomething());
 *   add(() => fetchOtherThing());
 *   await completion(); // resolves when both are done
 */
// GUARD: a non-positive / non-numeric threadCount would deadlock the queue
// (the dequeue loop `running < threads` never lets a task start,
// so completion() never resolves). Clamp to at least 1 — same sanitization
// the bench runner applies to its concurrency option
// (packages/agentic/bench/src/core/runner.ts runBench).
const normalizeThreadCount = (threadCount: number): number => {
    const parsed = Math.floor(threadCount);
    return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
};

export const taskCompletion = (threadCount = 1) => {
    // Threads clamp: 0 / NaN / negative must never deadlock the queue
    const threads = normalizeThreadCount(threadCount);
    // Tasks waiting to be executed. `head` is the read cursor: taking the next task
    // is `head++` rather than `queue.shift()`, which moves the whole tail on every
    // dispatch. Consumed slots are released in one shot once nothing is pending
    // (see the compaction step in `run`), so the array never grows unboundedly.
    const queue: (() => Promise<any>)[] = [];
    let head = 0;
    // Number of tasks currently in flight. A plain counter replaces the previous
    // `running: Promise[]` list plus `running.splice(running.indexOf(promise), 1)`
    // release: slot accounting only needs the count, and `indexOf` was an extra
    // O(n) scan (and a TDZ dance around the promise variable) per settle.
    let running = 0;
    // Stored resolver so the completion promise can fire when the queue drains
    let resolveCompletion: (() => void) | null = null;

    /** Slots that are still queued: everything pushed minus everything consumed. */
    const pending = () => queue.length - head;

    /**
     * Starts one queued entry and normalises its outcome into a settled-or-pending
     * promise. Three shapes must all produce a promise, because the caller relies on
     * the returned promise to release the slot:
     * - a non-function entry (`add(5)`): already a value, so it is settled now —
     *   previously `task()` threw `task is not a function` inside `run`, the task
     *   silently vanished and the error surfaced as an unhandled rejection;
     * - a function returning a non-promise (`add(() => 5)`): wrapped with
     *   `Promise.resolve` — previously `task(...).then is not a function` threw,
     *   `run` aborted before the drain check, and `completion()` resolved early
     *   (fast path) while the task had never really finished;
     * - a function that throws synchronously: captured as a rejected promise so the
     *   rejection path releases the slot and the queue keeps draining.
     *
     * The invocation itself stays SYNCHRONOUS: callers (and the bench runner) assert
     * how many tasks started directly after `add`, so the task body must begin during
     * the `add` call, not on a later microtask.
     */
    const startTask = (task: unknown): Promise<any> => {
        if (typeof task !== 'function') return Promise.resolve(task);
        try {
            return Promise.resolve((task as () => any)());
        } catch (error) {
            return Promise.reject(error);
        }
    };

    /**
     * Internal loop: pulls tasks from the queue up to `threads`
     * and executes them, chaining back to `run` when each finishes.
     */
    const run = async () => {
        // Keep pulling from the queue while there's room in the concurrency slot
        while (pending() > 0 && running < threads) {
            const task = queue[head++];
            // SLOT RELEASE ON BOTH OUTCOMES: the settled handler MUST run on
            // rejection too. Registering only a fulfillment handler (the old
            // behaviour) meant a REJECTED task was never removed from
            // `running` — its slot stayed occupied forever, queued tasks
            // never started, completion() hung, and the rejection surfaced
            // as an unhandled rejection (see the caveat consumers had to work
            // around in packages/test/models/src/benchmark-model.ts:531).
            // Swallowing here is deliberate: completion() is a drain signal,
            // not an error channel — callers capture task errors themselves
            // (e.g. benchmark-model's caseError, the bench runner's per-run
            // error records).
            const release = () => {
                // Free the slot this task was holding
                running -= 1;
                // Re-enter the loop to pick up the next queued task
                run();
            };
            // Bookkeeping happens BEFORE the task starts: `startTask` invokes the
            // task body synchronously and that body may `add` re-entrantly, and a
            // nested `run` must already see this slot as occupied or the scheduler
            // would overshoot `threads`.
            running += 1;
            startTask(task).then(release, release);
        }

        // Compaction: consumed slots are dropped only when the whole queue has been
        // consumed. A task enqueued from inside a running task keeps `queue.length`
        // above `head`, so it is never discarded by this reset.
        if (head === queue.length) {
            queue.length = 0;
            head = 0;
        }

        // When both the queue and running list are empty, resolve the completion promise
        if (pending() === 0 && running === 0 && resolveCompletion) {
            resolveCompletion();
        }
    };

    /**
     * Enqueue a new async task and attempt to start it immediately.
     * @param callback - A function that returns a Promise to be executed. Anything
     *                   else (a plain value, a synchronous return, a function that
     *                   throws) is still accepted and still settles — see
     *                   {@link startTask}.
     */
    const add = (callback: () => Promise<any>) => {
        queue.push(callback);
        // Unconditional dispatch. The previous body read
        // `if (completed) completed = false;` followed by `if (!completed) run();`,
        // which is tautologically true (the reset always ran first) and left an
        // uncoverable dead branch; the latch had no other reader, so both it and
        // the condition are gone.
        run();
    };

    /**
     * Returns a Promise that resolves when all enqueued tasks have completed.
     * If the queue is already empty with nothing running, resolves immediately.
     * @returns Promise that settles once the task queue is fully drained.
     */
    const completion = (): Promise<void> => {
        // Fast path: nothing to wait for
        if (pending() === 0 && running === 0) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            resolveCompletion = resolve;
        });
    };

    return { add, completion };
};
