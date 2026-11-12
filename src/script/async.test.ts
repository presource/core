import { scriptAsync, scriptPause } from '@presource/core';

describe('script async requirement', () => {
    it('should execute every function together', async () => {
        const script = scriptAsync();

        const animals: string[] = [];

        // Appending the function
        script.append(async () => {
            animals.push('cat');
            return true;
        });

        script.append(async () => {
            await scriptPause(10);
            animals.push('dog');
            return true;
        });

        script.append(async () => {
            animals.push('mouse');
            return true;
        });

        // Processing the list
        await script.process();

        // Expecting the result: the two immediate tasks run first (in append
        // order), the paused task lands last — proof the tasks are concurrent
        expect(animals).toStrictEqual(['cat', 'mouse', 'dog']);
    });

    it('should execute every function until completion', async () => {
        const script = scriptAsync();
        const fruits: string[] = [];

        script.append(async () => {
            fruits.push('apple');
        });

        script.append(async () => {
            // Basically retry later when 'banana' is in the list
            if (!fruits.includes('banana')) return false;
            // Guard clause passes, now we can add pear to the list
            fruits.push('pear');
        });

        // This comes after, and it adds banana to the list
        script.append(async () => {
            fruits.push('banana');
        });

        // Processing the script
        await script.process();

        // Expect this order
        expect(fruits).toStrictEqual(['apple', 'banana', 'pear']);
    });

    it('should execute all tasks in a complex chain of event', async () => {
        const script = scriptAsync();
        const queue: string[] = [];

        script.append(async () => {
            queue.push('John');
        });

        script.append(async () => {
            if (!queue.includes('Jane')) return false;
            // Jack is waiting for Jane to queue first
            queue.push('Jack');
        });

        script.append(async () => {
            if (!queue.includes('Jack')) return false;
            // Tom is waiting for Jack
            queue.push('Tom');
        });

        script.append(async () => {
            if (!queue.includes('Sarah')) return false;
            // Jane is waiting for Sarah
            queue.push('Jane');
        });

        script.append(async () => {
            queue.push('Tina');
        });

        script.append(async () => {
            queue.push('Sarah');
        });

        await script.process();

        // This is the order
        expect(queue).toStrictEqual(['John', 'Tina', 'Sarah', 'Jane', 'Jack', 'Tom']);
    });

    it('should abort when shouldContinue returns false', async () => {
        const script = scriptAsync();
        const executed: string[] = [];

        for (const name of ['task1', 'task2', 'task3']) {
            script.append(async () => {
                executed.push(name);
                return true;
            });
        }

        let callCount = 0;
        await script.process({
            shouldContinue: async () => {
                callCount++;
                return callCount < 2;
            }
        });

        // The kill lands on the second guard call, but all three tasks had already
        // passed their `killed` check, so each of them still consults the guard:
        // three guard calls for three successful tasks.
        expect(executed).toStrictEqual(['task1', 'task2', 'task3']);
        expect(callCount).toBe(3);
    });

    it('should resolve immediately when no tasks appended', async () => {
        const script = scriptAsync();

        let settled = 'pending';
        const first = script.process().then(() => {
            settled = 'resolved';
        });

        // `kickoff` finds zero pending tasks and resolves the drain signal at once
        // (src/script/async.ts:146-155) — no timer involved, one microtask is enough
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(settled).toBe('resolved');
        expect(await first).toBeUndefined();

        // Re-processing an empty queue keeps resolving with undefined
        expect(await script.process()).toBeUndefined();
    });

    it('should not re-enter a task once the run is killed', async () => {
        // Task A always asks for a retry; task B succeeds and the guard then kills
        // the run, so A's scheduled retry is skipped by the `if (!killed)` gate
        // (src/script/async.ts:135-138).
        const script = scriptAsync();
        const events: string[] = [];
        let retryCalls = 0;
        let guardCalls = 0;

        script.append(async () => {
            retryCalls++;
            events.push('retry');
            return false;
        });

        script.append(async () => {
            events.push('success');
            return true;
        });

        let settled = 'pending';
        const processed = script
            .process({
                shouldContinue: async () => {
                    guardCalls++;
                    events.push('guard');
                    return false;
                }
            })
            .then(() => {
                settled = 'resolved';
            });

        await processed;
        // One macrotask round: the pending setTimeout(0) retry would have fired by now
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(events).toStrictEqual(['retry', 'success', 'guard']);
        expect(retryCalls).toBe(1);
        expect(guardCalls).toBe(1);
        expect(settled).toBe('resolved');
    });

    it('should resolve before a slow task finishes when the run is killed', async () => {
        // The kill happens while task 1 is still awaiting: its continuation hits the
        // `if (killed) return;` guard right after the callback (src/script/async.ts:111).
        const script = scriptAsync();
        const events: string[] = [];

        script.append(async () => {
            await scriptPause(20);
            events.push('slow');
            return true;
        });

        script.append(async () => {
            events.push('fast');
            return true;
        });

        let settled = 'pending';
        const processed = script
            .process({
                shouldContinue: async () => false
            })
            .then(() => {
                settled = 'resolved';
            });

        // The drain fires from the kill path, while the slow task is still in flight
        await processed;
        expect(events).toStrictEqual(['fast']);
        expect(settled).toBe('resolved');

        // Flush the slow task (real timer, 20ms) and let its killed continuation run
        await scriptPause(30);
        expect(events).toStrictEqual(['fast', 'slow']);
    });

    it('should call shouldContinue once per successful task and kill on the first false', async () => {
        const script = scriptAsync();
        const events: string[] = [];
        let guardCalls = 0;

        script.append(async () => {
            events.push('first-success');
            return true;
        });

        script.append(async () => {
            events.push('second-success');
            return true;
        });

        await script.process({
            shouldContinue: async () => {
                guardCalls++;
                events.push(`guard:${guardCalls}`);
                // Continue after the first success, kill after the second
                return guardCalls === 1;
            }
        });

        expect(events).toStrictEqual(['first-success', 'second-success', 'guard:1', 'guard:2']);
        expect(guardCalls).toBe(2);
    });

    it('should cover checkDrained early return when killed flag is set', async () => {
        // Covers src/script/async.ts:97 — `if (killed) return;` inside `checkDrained`.
        // Both tasks pass their own `killed` check while it is still false, then both
        // await the guard. The guard kills for the FIRST caller (which resolves the
        // drain signal) and lets the SECOND caller through, so that task falls all the
        // way down to `checkDrained()` with `killed` already true: the early return
        // keeps `notifyDrained()` from firing a second time.
        const script = scriptAsync();
        const events: string[] = [];
        let guardCalls = 0;
        let settleCount = 0;

        script.append(async () => {
            events.push('A');
            return true;
        });

        script.append(async () => {
            events.push('B');
            return true;
        });

        const processed = script
            .process({
                shouldContinue: async () => {
                    guardCalls++;
                    // Only the second guard call reports "still allowed to continue"
                    events.push(`guard${guardCalls}:${guardCalls !== 1}`);
                    return guardCalls !== 1;
                }
            })
            .then(() => {
                settleCount++;
            });

        await processed;
        await new Promise<void>((resolve) => setImmediate(resolve));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(events).toStrictEqual(['A', 'B', 'guard1:false', 'guard2:true']);
        expect(guardCalls).toBe(2);
        // Single settlement: the killed guard suppressed the second drain notification
        expect(settleCount).toBe(1);
    });

    it('should skip a stale retry whose task already completed (runTask pending guard)', async () => {
        // Covers src/script/async.ts:105 — `if (killed || !task.flags.pending) return;`.
        // Two concurrent `process()` calls share one task list: the first call queues a
        // retry (setTimeout(0)) for task A, the second call runs A to completion
        // synchronously, so when the first call's retry re-enters `runTask`, A is no
        // longer pending and must not execute a third time. The extra slow task keeps
        // the first run's drain counter alive so that run still settles.
        const script = scriptAsync();
        const events: string[] = [];
        let aCalls = 0;
        let slowCalls = 0;

        script.append(async () => {
            aCalls++;
            events.push(`a${aCalls}`);
            // First pass asks for a retry, the second pass succeeds
            return aCalls === 1 ? false : true;
        });

        script.append(async () => {
            slowCalls++;
            events.push(`z${slowCalls}`);
            await scriptPause(60);
            events.push('zdone');
            return true;
        });

        let firstState = 'pending';
        let secondState = 'pending';
        const first = script.process().then(() => {
            firstState = 'resolved';
        });
        const second = script.process().then(() => {
            secondState = 'resolved';
        });

        // Both kickoffs run synchronously, and every task body runs synchronously up
        // to its first await — so all four first passes are recorded with no timer or
        // microtask flush involved. The retry timer for A (from the first run) has not
        // been reached yet, and neither run has drained.
        expect(events).toStrictEqual(['a1', 'z1', 'a2', 'z2']);
        expect(aCalls).toBe(2);
        expect(slowCalls).toBe(2);
        expect(firstState).toBe('pending');
        expect(secondState).toBe('pending');

        await Promise.all([first, second]);
        expect(events).toStrictEqual(['a1', 'z1', 'a2', 'z2', 'zdone', 'zdone']);
        // A ran exactly twice: the stale re-entry was short-circuited by the pending guard
        expect(aCalls).toBe(2);
        expect(slowCalls).toBe(2);
        expect(firstState).toBe('resolved');
        expect(secondState).toBe('resolved');
    });

    it('should leave the first run unsettled when a stale retry is its only task', async () => {
        // Same pending-guard path as above (src/script/async.ts:105), but without any
        // other in-flight task: the stale retry returns early WITHOUT notifying its own
        // drain signal, so the first `process()` promise never settles. Documented as-is
        // (the drain notification for an early return is the gap, src/script/async.ts:105).
        const script = scriptAsync();
        const events: string[] = [];
        let calls = 0;

        script.append(async () => {
            calls++;
            events.push(`run${calls}`);
            return calls === 1 ? false : true;
        });

        let firstState = 'pending';
        const first = script.process().then(() => {
            firstState = 'resolved';
        });
        const second = await script.process();

        // Let the scheduled retry timer (setTimeout(0)) fire and settle
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await new Promise<void>((resolve) => setImmediate(resolve));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(events).toStrictEqual(['run1', 'run2']);
        expect(calls).toBe(2);
        expect(second).toBeUndefined();
        expect(firstState).toBe('pending');
    });

    it('should not run tasks appended after process() has started', async () => {
        // `kickoff` snapshots the pending list synchronously, so a later append is
        // invisible to the in-flight run (src/script/async.ts:146-157).
        const script = scriptAsync();
        let calls = 0;

        const processed = script.process();
        script.append(async () => {
            calls++;
            return true;
        });

        expect(await processed).toBeUndefined();
        expect(calls).toBe(0);

        // The appended task only runs on the next process() call
        await script.process();
        expect(calls).toBe(1);
    });

    it('should return the same handler from append for chaining', async () => {
        const script = scriptAsync();

        const returned = script.append(async () => true);

        expect(returned).toBe(script);
        expect(Object.keys(script)).toStrictEqual(['append', 'process']);
    });

    it('should retry a task that returns false and stop once it succeeds', async () => {
        // `false` is the only retry trigger; the internal retry counter is not
        // exposed, so the observable contract is the exact number of invocations.
        const script = scriptAsync();
        let calls = 0;

        script.append(async () => {
            calls++;
            return calls === 3;
        });

        expect(await script.process()).toBeUndefined();
        // Two retries (calls 1 and 2), success on the third
        expect(calls).toBe(3);
    });

    it('should treat undefined and true returns as success without retrying', async () => {
        const script = scriptAsync();
        let voidCalls = 0;
        let trueCalls = 0;
        let undefinedCalls = 0;

        script.append(async () => {
            voidCalls++;
        });
        script.append(async () => {
            trueCalls++;
            return true;
        });
        script.append(async () => {
            undefinedCalls++;
            return undefined;
        });

        await script.process();

        expect([voidCalls, trueCalls, undefinedCalls]).toStrictEqual([1, 1, 1]);
    });

    it('should only call shouldContinue after a successful task', async () => {
        // A retried (false) task never reaches the guard, so with two successes the
        // guard fires exactly twice even though the retrying task ran twice.
        const script = scriptAsync();
        const events: string[] = [];
        let aCalls = 0;
        let guardCalls = 0;

        script.append(async () => {
            aCalls++;
            events.push(`a${aCalls}`);
            return aCalls === 2;
        });

        script.append(async () => {
            events.push('b');
            return true;
        });

        await script.process({
            shouldContinue: async () => {
                guardCalls++;
                events.push(`g${guardCalls}`);
                return true;
            }
        });

        expect(aCalls).toBe(2);
        expect(guardCalls).toBe(2);
        expect(events).toStrictEqual(['a1', 'b', 'g1', 'a2', 'g2']);
    });

    it('should not re-run completed tasks on a second process call', async () => {
        const script = scriptAsync();
        let calls = 0;

        script.append(async () => {
            calls++;
            return true;
        });

        await script.process();
        const second = await script.process();

        // `kickoff` filters on `flags.pending`, so the completed task is skipped and
        // the empty pending list resolves the drain signal immediately
        expect(calls).toBe(1);
        expect(second).toBeUndefined();
    });

    it('should never settle and surface an escaping rejection as an unhandled rejection', async () => {
        // A task that rejects while pending escapes `await task.callback()`
        // (src/script/async.ts:108): the `running--` and drain bookkeeping never run,
        // so `process()` hangs and the error only shows up as an unhandled rejection.
        const script = scriptAsync();
        const events: string[] = [];

        script.append(async () => {
            events.push('throw');
            throw new Error('boom');
        });

        script.append(async () => {
            events.push('ok');
            return true;
        });

        let state = 'pending';
        script.process().then(() => {
            state = 'resolved';
        });

        // Capture the escaped rejection so it cannot terminate the worker; the
        // assertion is exact (one rejection, original message).
        const previousListeners = process.listeners('unhandledRejection') as unknown as ((...args: any[]) => void)[];
        const rejections: string[] = [];
        const listener = (reason: unknown) => {
            rejections.push(reason instanceof Error ? reason.message : String(reason));
        };
        process.removeAllListeners('unhandledRejection');
        process.on('unhandledRejection', listener);
        try {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            await new Promise<void>((resolve) => setImmediate(resolve));
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        } finally {
            process.removeAllListeners('unhandledRejection');
            previousListeners.forEach((existing) => process.on('unhandledRejection', existing));
        }

        expect(events).toStrictEqual(['throw', 'ok']);
        expect(state).toBe('pending');
        expect(rejections).toStrictEqual(['boom']);
    });

    it('should swallow a rejection that escapes the fire-and-forget retry path', async () => {
        // The retry is invoked without awaiting (src/script/async.ts:136-137), so a
        // rejection from a retried pass is lost by the runner: the original task
        // promise already settled, but the drain still never fires because the retry
        // leaked its `running` increment.
        const script = scriptAsync();
        const events: string[] = [];
        let calls = 0;

        script.append(async () => {
            calls++;
            if (calls === 1) {
                events.push('retry-me');
                return false;
            }
            events.push('throw-on-retry');
            throw new Error('retryboom');
        });

        script.append(async () => {
            events.push('ok');
            return true;
        });

        let state = 'pending';
        script.process().then(() => {
            state = 'resolved';
        });

        const previousListeners = process.listeners('unhandledRejection') as unknown as ((...args: any[]) => void)[];
        const rejections: string[] = [];
        const listener = (reason: unknown) => {
            rejections.push(reason instanceof Error ? reason.message : String(reason));
        };
        process.removeAllListeners('unhandledRejection');
        process.on('unhandledRejection', listener);
        try {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            await new Promise<void>((resolve) => setImmediate(resolve));
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        } finally {
            process.removeAllListeners('unhandledRejection');
            previousListeners.forEach((existing) => process.on('unhandledRejection', existing));
        }

        expect(calls).toBe(2);
        expect(events).toStrictEqual(['retry-me', 'ok', 'throw-on-retry']);
        expect(state).toBe('pending');
        expect(rejections).toStrictEqual(['retryboom']);
    });
});
