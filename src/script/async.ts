/**
 * Async task runner.
 *
 * Allows appending multiple async callbacks and then processing them
 * concurrently. Tasks that return `false` are automatically retried;
 * tasks returning anything else are considered successful. An optional
 * `shouldContinue` guard can halt the entire run early.
 */

/** Optional input provided to {@link ScriptAsync.process}. */
type Input = {
    /**
     * Called after each successfully-completed task. Returning `false`
     * aborts the entire process, marking all remaining tasks as skipped.
     */
    shouldContinue?: () => Promise<boolean>;
};

// TODO: pending - Configs type is {} (unused). Remove or implement
/** Configuration object for the async runner (reserved for future use). */
type Configs = {};

/** A single async task callback. Return `false` to signal a retry. */
type Callback = () => Promise<boolean | void>;

/**
 * Signature for {@link scriptAsync}.
 *
 * @param configs - Reserved configuration object.
 * @returns A handler with `append` and `process` methods.
 */
export type ScriptAsync = (configs?: Configs) => {
    /** Append a callback to the task queue; returns the handler for chaining. */
    append: (callback: Callback) => ReturnType<ScriptAsync>;
    /** Start (or restart) execution of all pending tasks. */
    process: (input?: Input) => Promise<void>;
};

/** Internal representation of a queued task. */
type Task = {
    callback: Callback;
    flags: {
        /** `true` while the task has not yet succeeded. */
        pending: boolean;
        /** `true` once the task has completed successfully. */
        completed: boolean;
    };
    counter: {
        /** Number of retry attempts so far. */
        retries: number;
    };
};

/**
 * Create an async task runner that executes appended callbacks concurrently.
 *
 * Tasks are started in parallel. If a task returns `false` it is
 * rescheduled (after yielding to the event loop) so other tasks can
 * make progress. The `process` call resolves when all tasks have
 * succeeded or the process is killed via `shouldContinue`.
 *
 * @param configs - Configuration object (currently unused).
 * @returns A handler with `append` and `process`.
 */
export const scriptAsync: ScriptAsync = (configs = {}) => {
    const tasks: Task[] = [];

    const handler: ReturnType<ScriptAsync> = {
        append: (callback) => {
            tasks.push({
                callback,
                flags: {
                    pending: true,
                    completed: false
                },
                counter: {
                    retries: 0
                }
            });

            return handler;
        },
        process: async (input) => {
            let killed = false;

            // Deferred resolver – fires when every task has settled or the run is killed
            let notifyDrained: () => void;
            const drained = new Promise<void>((resolve) => {
                notifyDrained = resolve;
            });

            // Track how many tasks are actively running (not yet settled)
            let running = 0;

            /** Fire `notifyDrained` if there is nothing left to do. */
            const checkDrained = () => {
                if (killed) return;
                if (running === 0 && getRemainingTaskPending(tasks) === 0) {
                    notifyDrained();
                }
            };

            /** Execute a single task, handling success / retry / kill logic. */
            const runTask = async (task: Task): Promise<void> => {
                if (killed || !task.flags.pending) return;

                running++;
                const success = await task.callback();
                running--;

                if (killed) return;

                // `undefined` and `true` are both treated as success
                if (success !== false) {
                    task.flags.pending = false;
                    task.flags.completed = true;
                    task.counter.retries = 0;

                    let keepGoing = true;

                    if (input?.shouldContinue) {
                        keepGoing = await input.shouldContinue();
                    }

                    if (!keepGoing) {
                        killed = true;
                        notifyDrained();
                        return;
                    }
                } else {
                    // Retry: reschedule this task after other pending tasks have had a chance to run
                    task.counter.retries++;
                    // Yield to the event loop so other tasks can progress before we retry
                    await new Promise<void>((resolve) => setTimeout(resolve, 0));
                    if (!killed) {
                        // TODO: pending - BUG: runTask(task) is fire-and-forget. Errors from retry are silently lost. Should await or catch
                        runTask(task); // fire-and-forget retry
                    }
                    return;
                }

                checkDrained();
            };

            // Kick off all currently pending tasks
            const kickoff = () => {
                const pending = tasks.filter((t) => t.flags.pending);

                if (pending.length === 0) {
                    notifyDrained();
                    return;
                }

                pending.forEach((task) => runTask(task));
            };

            kickoff();
            await drained;
        }
    };

    return handler;
};

/** Count how many tasks are still pending. */
const getRemainingTaskPending = (tasks: Task[]) => {
    return tasks.filter((task) => task.flags.pending).length;
};
