import { scriptPause, taskCompletion } from '@presource/core';

describe('taskCompletion requirements', () => {
    it('should able to execute tasks correctly', async () => {
        const result: string[] = [];
        // Creating a new task with 3 thread
        const task = taskCompletion(3);

        //  Adding a new task
        task.add(async () => {
            result.push('apple');
        });

        task.add(async () => {
            result.push('banana');
        });

        // Wait for all tasks complete their run
        await task.completion();

        expect(result).toStrictEqual(['apple', 'banana']);
    });

    it('should not able to execute tasks correctly', async () => {
        // Creating a new task with 3 thread
        const task = taskCompletion(3);
        const list: string[] = [];

        task.add(async () => {
            // Slow this down by waiting 100ms
            await scriptPause(100);
            list.push('ben');
        });

        task.add(async () => {
            list.push('george');
        });

        task.add(async () => {
            list.push('jennifer');
        });

        task.add(async () => {
            list.push('billy');
        });

        // Wait for all task to be completed
        await task.completion();

        expect(list).toStrictEqual(['george', 'jennifer', 'billy', 'ben']);
    });

    it('should able to queue tasks correctly', async () => {
        // Creating a new task
        const task = taskCompletion(5);

        let running = 0;
        const runningThread = async () => {
            running++;
            // Going to wait for 500 ms
            await scriptPause(100);
            running--;
        };

        // Running multiple threads
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);

        // Expecting the running amoutn to be 5
        expect(running).toBe(5);

        // Wait for all task to be completed
        await task.completion();

        // Expect all tasks to be completed
        expect(running).toBe(0);
    });

    it('should able to continue after completion by adding more threads', async () => {
        // Creating a new task
        const task = taskCompletion(3);
        let counter = 0;
        const runningThread = async () => {
            // Going to wait for 500 ms
            await scriptPause(100);
            counter++;
        };

        // Running multiple threads
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);

        // Wait for all task to be completed
        await task.completion();

        // Expect all tasks to be completed
        expect(counter).toBe(4);

        // Add more thread
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);
        task.add(runningThread);

        // Wait for all task to be completed
        await task.completion();
        // Expect all tasks to be completed
        expect(counter).toBe(8);
    });

    it('should resolve immediately when queue is empty', async () => {
        const task = taskCompletion();
        // Fast path: completion() on empty queue returns immediately
        await task.completion();
        expect(true).toBe(true);
    });

    it('should not run new tasks after completion has resolved', async () => {
        const task = taskCompletion(1);
        const result: string[] = [];

        task.add(async () => {
            result.push('first');
        });

        // Wait for all tasks to complete
        await task.completion();
        expect(result).toStrictEqual(['first']);

        // Adding more tasks after completion - the completed flag resets and tasks run
        task.add(async () => {
            result.push('second');
        });

        // New tasks should process on next completion()
        await task.completion();
        expect(result).toStrictEqual(['first', 'second']);
    });

    // REGRESSION (slot starvation): a REJECTED task used to stay in the
    // internal `running` list forever — its slot was never released, queued
    // tasks never started, and completion() hung (consumers had to wrap every
    // task in try/catch, see packages/test/models/src/benchmark-model.ts:531).
    it('releases the slot and keeps draining when a task rejects', async () => {
        const task = taskCompletion(1);
        const result: string[] = [];

        // Task 1 rejects — its slot must free up for the queued tasks
        task.add(async () => {
            throw new Error('boom');
        });
        task.add(async () => {
            result.push('after-failure');
        });

        // completion() must resolve (previously it hung forever)
        await task.completion();
        expect(result).toStrictEqual(['after-failure']);
    });

    it('runs queued tasks in parallel after an in-flight task rejects', async () => {
        const task = taskCompletion(2);
        let inFlight = 0;
        let maxInFlight = 0;
        const result: string[] = [];

        const tracked = async (label: string) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await scriptPause(50);
            result.push(label);
            inFlight -= 1;
        };

        // First task rejects mid-flight; the second keeps its slot and the
        // queued third must start the moment either slot frees
        task.add(async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await scriptPause(10);
            inFlight -= 1;
            throw new Error('boom');
        });
        task.add(() => tracked('b'));
        task.add(() => tracked('c'));

        await task.completion();
        expect(result).toStrictEqual(['b', 'c']);
        // Concurrency was actually used (2 tasks overlapped)
        expect(maxInFlight).toBe(2);
    });

    it('clamps a non-positive threadCount to 1 instead of deadlocking', async () => {
        // 0 / negative previously left the dequeue loop permanently closed:
        // tasks queued but never ran, completion() never resolved
        const task = taskCompletion(0);
        const result: string[] = [];
        task.add(async () => {
            result.push('ran');
        });
        await task.completion();
        expect(result).toStrictEqual(['ran']);
    });

    // normalizeThreadCount (src/task/completion.ts:23-26) floors the value and
    // clamps anything below 1 (including NaN) to 1, so the number of tasks that
    // start synchronously inside `add` is exactly the clamped thread count.
    it.each([
        [0, 1],
        [-5, 1],
        [Number.NaN, 1],
        [2.7, 2],
    ] as const)('threadCount %p is normalized to %p concurrent tasks', async (threads, expectedConcurrency) => {
        const task = taskCompletion(threads);
        let inFlight = 0;
        let peak = 0;

        const tracked = async () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await scriptPause(20);
            inFlight -= 1;
        };

        for (let index = 0; index < 4; index++) task.add(tracked);

        // `add` -> `run` fills the available slots synchronously
        expect(inFlight).toBe(expectedConcurrency);

        await task.completion();

        expect(peak).toBe(expectedConcurrency);
        expect(inFlight).toBe(0);
    });

    it('runs a task enqueued from inside another running task', async () => {
        const task = taskCompletion(1);
        const events: string[] = [];

        task.add(async () => {
            events.push('outer');
            // Re-entrant add: the inner task is queued while `run` is on the stack
            task.add(async () => {
                events.push('inner');
            });
        });

        await task.completion();
        expect(events).toStrictEqual(['outer', 'inner']);
    });

    it('drains after a task rejects with a non-Error reason', async () => {
        // `run()` registers the same release handler for fulfilment AND rejection
        // (`startTask(task).then(release, release)` in src/task/completion.ts), so
        // even a thrown non-Error frees its slot.
        const task = taskCompletion(1);
        const events: string[] = [];

        task.add(async () => {
            throw 'string-reason';
        });
        task.add(async () => {
            events.push('after');
        });

        await task.completion();
        expect(events).toStrictEqual(['after']);
    });

    // ------------------------------------------------------------------
    // G3 — every queued entry must settle, whatever shape it has
    // ------------------------------------------------------------------

    it('resolves completion after a queued sync-returning task instead of resolving early', async () => {
        // threads = 1 forces the sync task to wait for the in-flight one. The old
        // runner called `.then` on the plain `5` the task returned, which threw
        // `task(...).then is not a function` inside `run`: the drain check never
        // ran, so completion() hung and the TypeError escaped as an unhandled
        // rejection while the task looked like it had silently vanished.
        const task = taskCompletion(1);
        const events: string[] = [];

        const syncTask = () => {
            events.push('sync-return');
            // A plain non-promise return value
            return 5;
        };

        task.add(async () => {
            await scriptPause(20);
            events.push('slow-async');
        });
        task.add(syncTask as any);

        await task.completion();

        // completion() only resolved once BOTH tasks had actually settled, in the
        // order the single slot allowed
        expect(events).toStrictEqual(['slow-async', 'sync-return']);
    });

    it('settles a non-function task and keeps the queue usable', async () => {
        // `add(5)`: the old runner threw `task is not a function` while dispatching
        // it — the entry silently vanished and completion() resolved early.
        const task = taskCompletion(1);
        const events: string[] = [];

        task.add(5 as any);
        task.add(async () => {
            await scriptPause(20);
            events.push('after');
        });

        await task.completion();
        expect(events).toStrictEqual(['after']);
    });

    it('drains and resolves completion when a task throws synchronously', async () => {
        // A synchronous throw is captured as a rejected task, so the slot is
        // released on the rejection path and the queued task still starts.
        const task = taskCompletion(1);
        const events: string[] = [];

        const thrower = () => {
            throw new Error('sync-boom');
        };

        task.add(thrower as any);
        task.add(async () => {
            events.push('after');
        });

        await task.completion();
        expect(events).toStrictEqual(['after']);
    });

    it('starts sync-returning and non-function tasks synchronously inside add', async () => {
        // The hardening must NOT defer dispatch behind `Promise.resolve().then(...)`:
        // callers (and the bench runner) assert how many tasks started directly
        // after `add`, before any microtask runs.
        const task = taskCompletion(2);
        const order: string[] = [];

        task.add((() => {
            order.push('a');
            return 1;
        }) as any);
        task.add(() => {
            order.push('b');
        });

        expect(order).toStrictEqual(['a', 'b']);
        await task.completion();
        // completion() did not start anything a second time
        expect(order).toStrictEqual(['a', 'b']);
    });

    it('does not overshoot threadCount when a running task adds a task synchronously', async () => {
        // M6/slot-accounting contract: the slot is booked BEFORE the task body runs,
        // so a synchronous re-entrant `add` from inside that body cannot start a
        // second task on the same slot. The inner task waits for the outer one to
        // settle instead of running inline.
        const task = taskCompletion(1);
        const order: string[] = [];
        let inFlight = 0;
        let peak = 0;

        const inner = () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            order.push('inner');
            inFlight -= 1;
        };

        task.add((() => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            order.push('outer-start');
            task.add(inner as any);
            order.push('outer-end');
            inFlight -= 1;
        }) as any);

        // Nothing else ran while the outer task held the only slot
        expect(order).toStrictEqual(['outer-start', 'outer-end']);
        expect(peak).toBe(1);

        await task.completion();

        expect(order).toStrictEqual(['outer-start', 'outer-end', 'inner']);
        expect(peak).toBe(1);
        expect(inFlight).toBe(0);
    });

    it('dispatches every task of a long queue with the head-cursor dequeue', async () => {
        // Guards the `head++` cursor + drain-time compaction against skipping or
        // duplicating tasks around the compaction boundary.
        const task = taskCompletion(1);
        const order: number[] = [];
        const expected: number[] = [];

        for (let index = 0; index < 25; index++) {
            expected.push(index);
            task.add(async () => {
                await scriptPause(1);
                order.push(index);
            });
        }

        await task.completion();

        // Exact FIFO expectation: every task ran once, in enqueue order
        expect(order).toStrictEqual(expected);
    });

    it('leaves no unhandled rejection for non-promise, non-function, or sync-throwing tasks', async () => {
        // Capture convention shared with src/script/async.test.ts:528-541.
        const previousListeners = process.listeners('unhandledRejection') as unknown as ((...args: any[]) => void)[];
        const rejections: string[] = [];
        const listener = (reason: unknown) => {
            rejections.push(reason instanceof Error ? reason.message : String(reason));
        };
        process.removeAllListeners('unhandledRejection');
        process.on('unhandledRejection', listener);

        try {
            const task = taskCompletion(2);

            task.add(5 as any);
            task.add((() => 7) as any);
            task.add((() => {
                throw new Error('sync-boom');
            }) as any);

            await task.completion();
            // Extra ticks so node can publish anything it considers unhandled
            await scriptPause(0);

            expect(rejections).toStrictEqual([]);
        } finally {
            process.removeAllListeners('unhandledRejection');
            previousListeners.forEach((existing) => process.on('unhandledRejection', existing));
        }
    });

    it('orphans an earlier completion() promise when completion() is called twice', async () => {
        // KNOWN GAP (not fixed here): completion() overwrites `resolveCompletion`
        // in src/task/completion.ts, so only the most recent pending completion()
        // promise is ever settled — an earlier one hangs forever.
        const task = taskCompletion(1);
        let releaseTask: () => void = () => {
            /* replaced below */
        };
        const gate = new Promise<void>((resolve) => {
            releaseTask = resolve;
        });

        task.add(async () => {
            await gate;
        });

        let firstState = 'pending';
        task.completion().then(() => {
            firstState = 'resolved';
        });

        let secondState = 'pending';
        const second = task.completion().then(() => {
            secondState = 'resolved';
        });

        releaseTask();
        await second;

        expect(secondState).toBe('resolved');
        expect(firstState).toBe('pending');

        // The queue itself stays usable: `add` dispatches unconditionally, so the
        // next run drains normally even after a completion() has resolved.
        const events: string[] = [];
        task.add(async () => {
            events.push('after');
        });
        await task.completion();
        expect(events).toStrictEqual(['after']);
    });

    // NOTE on coverage: the old `add` body read
    // `if (completed) completed = false;` followed by `if (!completed) run();`.
    // The reset always ran first, so line 85 was tautologically true and its
    // false side was an uncoverable dead branch. That branch (and the latch, which
    // had no other reader) is gone — `add` pushes and dispatches unconditionally,
    // so there is no uncovered branch left in this module.
});
