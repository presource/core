import { functionQueue } from '@presource/core';

/**
 * Contract under test: `functionQueue(listener)` (src/function/queue.ts).
 *
 * Enqueuing defers `processQueue` with `functionDelay`, so several items can be
 * collected before the first one runs. Each item is executed inside its own
 * `functionDelay(cb, item.delay || 0)`, so a per-item `delay` gates that item only.
 *
 * Two behaviours callers must know about (pinned below, source left untouched):
 * - `busy` (queue.ts:53) is only cleared by `continueQueue`, so a drained queue
 *   leaves it `true` and never processes a later enqueue (queue.ts:98-104).
 * - a falsy entry (queue.ts:85) is shifted and skipped without calling
 *   `continueQueue`, which stalls the same queue for the very same reason.
 *
 * CHANGED (defect G1, this round): a REJECTED async item no longer wedges the
 * queue. It is reported through `execute` as `{ queue, response: undefined, error }`
 * and the queue keeps draining, so the rejection is observed instead of turning
 * into an `unhandledRejection` (pinned by the `G1 —` cases below). A callback that
 * throws SYNCHRONOUSLY is still not caught — that boundary is pinned too.
 */
describe('How to use Function Queue - ability to queue function in a list', () => {
    // We will need to simulate some fate timer first.
    vi.useFakeTimers();

    afterEach(() => {
        // No pending timer may survive into the next test
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('can be used to queue a function, running it later', () => {
        // Creating a Function Queue
        const queue = functionQueue();
        const result: any = [];
        queue(() => {
            result.push(1);
        });
        // Run All Timer
        vi.runAllTimers();
        // Checking the Result to be Equal
        expect(result).toStrictEqual([1]);
    });

    it('should be able to queue function in a series', () => {
        // Creating a new queue
        const queue = functionQueue();
        const result: any = [];

        queue(() => {
            result.push(1);
        });

        queue(() => {
            result.push(2);
        });

        queue(() => {
            result.push(3);
        });

        vi.runAllTimers();
        expect(result).toStrictEqual([1, 2, 3]);
    });

    it('should be able to queue function in a nested series', () => {
        // Let's create a queue list
        const queue = functionQueue();
        // this is for testing the result at the end.
        const result: number[] = [];

        // Let's queue an item
        queue(() => {
            // Adding first item
            result.push(1);

            // Add some children, and we should expect these children to be executed first.
            queue(() => {
                result.push(1.1);
            });
            queue(() => {
                result.push(1.2);
            });
        });

        // Alternatively, you can use the provided queue function for appending new calls into the queue
        queue(({ queue }) => {
            result.push(2);
            // Using pass down queue handler should also work
            queue(() => {
                result.push(2.1);
            });
            queue(() => {
                result.push(2.2);
            });
        });

        // Executing all timer
        vi.runAllTimers();
        // Expecting Result in Order of Processing
        expect(result).toStrictEqual([1, 1.1, 1.2, 2, 2.1, 2.2]);
    });

    it('should able to execute listeners correctly', () => {
        // This is for updating the result
        const result: string[] = [];
        // Building a queue  list with add on logics.
        const queue = functionQueue({
            complete: () => {
                result.push('done');
            }
        });

        // Adding an apple to the queue list
        queue(() => {
            result.push('apple');
        });

        // Adding a banana to the queue list
        queue(() => {
            result.push('banana');
        });

        // This is to execute everything.
        vi.runAllTimers();
        // And we expect the result to be as such
        expect(result).toStrictEqual(['apple', 'banana', 'done']);

        // Now, you can queue items faster than the script executing them.
        // That is the beauty of this function.
    });

    it('fires the execute listener once per item with the exact payload', () => {
        const execute = vi.fn();
        const complete = vi.fn();
        const queue = functionQueue({ execute, complete });

        // Named references make the payload assertions exact
        const itemA = () => 'response-a';
        const itemB = () => undefined;

        queue(itemA);
        queue(itemB);

        vi.runAllTimers();

        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenNthCalledWith(1, { queue: itemA, response: 'response-a' });
        expect(execute).toHaveBeenNthCalledWith(2, { queue: itemB, response: undefined });
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenNthCalledWith(1);
    });

    it('awaits a promise-returning item before running the next one', async () => {
        const order: string[] = [];
        const execute = vi.fn();
        const queue = functionQueue({ execute });

        const asyncItem = async () => {
            order.push('async-start');
            // Microtask only, so the fake clock never has to model real latency
            await Promise.resolve();
            order.push('async-end');
            return 'async-response';
        };
        const nextItem = () => {
            order.push('next');
        };

        queue(asyncItem);
        queue(nextItem);

        // runAllTimersAsync flushes the microtasks the promise chain needs
        await vi.runAllTimersAsync();

        expect(order).toStrictEqual(['async-start', 'async-end', 'next']);
        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenNthCalledWith(1, { queue: asyncItem, response: 'async-response' });
        expect(execute).toHaveBeenNthCalledWith(2, { queue: nextItem, response: undefined });
    });

    it('delays an individual item without delaying its neighbours', () => {
        const order: string[] = [];
        const queue = functionQueue();

        const controlA = queue(() => order.push('A'));
        const controlB = queue(() => order.push('B'));

        // The setters mutate the queued script itself and return the assigned value
        expect(Object.keys(controlA)).toStrictEqual(['delay', 'id']);
        expect(controlA.delay(120)).toBe(120);
        expect(controlA.id('id-a')).toBe('id-a');

        const memory = queue();
        expect(memory.queue[0].delay).toBe(120);
        expect(memory.queue[0].id).toBe('id-a');
        expect(memory.queue[1].delay).toBeUndefined();

        // The slow head of the queue holds everything back
        vi.advanceTimersByTime(30);
        expect(order).toStrictEqual([]);
        expect(memory.queue.length).toBe(2);

        vi.runAllTimers();
        expect(order).toStrictEqual(['A', 'B']);
    });

    it('splices new items ahead of later ones at the write pointer', () => {
        const order: number[] = [];
        const queue = functionQueue();

        // Item 2 is enqueued first, then item 1 injects children while running
        queue(() => {
            order.push(1);
            queue(() => order.push(1.1));
        });
        queue(() => order.push(2));

        vi.runAllTimers();
        expect(order).toStrictEqual([1, 1.1, 2]);

        // Enqueues while the queue is idle still respect insertion order
        const second = functionQueue();
        const orderB: string[] = [];
        second(() => orderB.push('a'));
        second(() => orderB.push('b'));
        second(() => orderB.push('c'));
        vi.runAllTimers();
        expect(orderB).toStrictEqual(['a', 'b', 'c']);
    });

    it('kills the queue without running the pending items', () => {
        const complete = vi.fn();
        const queue = functionQueue({ complete });
        const item = () => 'never';

        queue(item);
        expect(queue().queue.length).toBe(1);

        // kill returns undefined and empties the internal array
        expect(queue.kill()).toBeUndefined();
        expect(queue().queue).toStrictEqual([]);

        vi.runAllTimers();
        // The item never ran, but the `complete` listener still fires because the
        // deferred `processQueue` finds an empty queue (queue.ts:98-104)
        expect(complete).toHaveBeenCalledTimes(1);
    });

    it('kill on a queue that never enqueued anything is completely silent', () => {
        const execute = vi.fn();
        const complete = vi.fn();
        const queue = functionQueue({ execute, complete });

        // Nothing was ever enqueued, so no deferred processor is pending
        expect(queue.kill()).toBeUndefined();
        expect(queue().queue).toStrictEqual([]);

        // A second kill keeps it silent — `complete` only comes from a processed queue
        expect(queue.kill()).toBeUndefined();
        vi.runAllTimers();
        expect(complete).toHaveBeenCalledTimes(0);
        expect(execute).toHaveBeenCalledTimes(0);
    });

    it('done completes the queue immediately', () => {
        const order: string[] = [];
        const queue = functionQueue({ complete: () => order.push('complete') });

        queue(() => order.push('item'));

        // done() clears and reports synchronously
        expect(queue.done()).toBeUndefined();
        expect(order).toStrictEqual(['complete']);
        expect(queue().queue).toStrictEqual([]);

        vi.runAllTimers();
        // The enqueue's deferred processQueue drains the now-empty queue and
        // reports completion a second time
        expect(order).toStrictEqual(['complete', 'complete']);
    });

    it('returns the mutable internal memory when called without arguments', () => {
        const listener = { execute: () => undefined, complete: () => undefined };
        const queue = functionQueue(listener);

        const memory = queue();
        // Same object on every read, and the listener is stored by reference
        expect(memory).toBe(queue());
        expect(memory.queue).toBe(queue().queue);
        expect(Object.keys(memory)).toStrictEqual(['queue', 'on']);
        expect(memory.on).toBe(listener);

        // The default listener is an empty object
        expect(Object.keys(functionQueue()().on)).toStrictEqual([]);

        const item = () => undefined;
        queue(item);
        expect(memory.queue.length).toBe(1);
        expect(memory.queue[0]).toBe(item);
    });

    it('honours direct mutations of memory.queue made before processing', () => {
        const order: string[] = [];
        const queue = functionQueue();
        const memory = queue();

        queue(() => order.push('queued'));
        // Writing straight into the internal array still participates in processing
        memory.queue.unshift(() => order.push('unshifted'));
        memory.queue.push(() => order.push('pushed'));

        vi.runAllTimers();
        expect(order).toStrictEqual(['unshifted', 'queued', 'pushed']);
        expect(memory.queue).toStrictEqual([]);
    });

    it('drops items removed from memory.queue before processing', () => {
        const order: string[] = [];
        const queue = functionQueue();
        const memory = queue();

        queue(() => order.push('a'));
        queue(() => order.push('b'));
        // Truncating the live array removes `b` from the schedule
        memory.queue.length = 1;

        vi.runAllTimers();
        expect(order).toStrictEqual(['a']);
    });

    it('leaves an empty queue after processing, then stops processing new items', () => {
        const order: string[] = [];
        const queue = functionQueue();

        queue(() => order.push('A'));
        vi.runAllTimers();
        expect(order).toStrictEqual(['A']);
        expect(queue().queue).toStrictEqual([]);

        // The drain never resets `busy`, so this item is stored but never run
        const pending = () => order.push('B');
        queue(pending);
        vi.runAllTimers();
        expect(order).toStrictEqual(['A']);
        expect(queue().queue.length).toBe(1);
        expect(queue().queue[0]).toBe(pending);
    });

    it('queue.ts:85 — a falsy entry is shifted and skipped without any listener firing', () => {
        const execute = vi.fn();
        const complete = vi.fn();
        const queue = functionQueue({ execute, complete });
        const order: string[] = [];
        const itemA = () => order.push('A');

        queue(itemA);
        const memory = queue();
        // `0` is falsy but still destructurable, so `const { delay } = queue[0]`
        // succeeds, the shift happens, and `if (callback)` takes the false branch
        memory.queue.unshift(0);

        vi.runAllTimers();

        expect(order).toStrictEqual([]);
        expect(execute).toHaveBeenCalledTimes(0);
        expect(complete).toHaveBeenCalledTimes(0);
        // The falsy entry was consumed, `itemA` remains, and the queue is stalled
        expect(memory.queue.length).toBe(1);
        expect(memory.queue[0]).toBe(itemA);

        // A later enqueue cannot revive it because `continueQueue` never ran
        queue(() => order.push('B'));
        vi.runAllTimers();
        expect(order).toStrictEqual([]);
        expect(memory.queue.length).toBe(2);
    });

    it('queue.ts:85 — a null entry throws while reading its delay and is left in place', () => {
        const execute = vi.fn();
        const queue = functionQueue({ execute });
        const order: string[] = [];

        queue(() => order.push('A'));
        const memory = queue();
        memory.queue.unshift(null);

        // `const { delay } = null` (queue.ts:74) throws inside the timer callback
        expect(() => vi.runAllTimers()).toThrow(TypeError);
        expect(order).toStrictEqual([]);
        expect(execute).toHaveBeenCalledTimes(0);
        // Nothing was shifted, so both entries survive
        expect(memory.queue.length).toBe(2);
    });

    // ------------------------------------------------------------------
    // G1 — a rejected async item must release the queue instead of wedging it
    // ------------------------------------------------------------------

    it('G1 — a rejected async item releases the queue and the run keeps draining', async () => {
        const seen: string[] = [];
        const execute = vi.fn(() => seen.push('execute'));
        const complete = vi.fn(() => seen.push('complete'));
        const queue = functionQueue({ execute, complete });

        const failure = new Error('boom');
        const rejecting = () => Promise.reject(failure);
        // Block body so the item resolves with `undefined` (the payload assertion
        // below is exact, and `seen.push` would otherwise return the array length)
        const second = () => {
            seen.push('second');
        };

        queue(rejecting);
        queue(second);

        // The settlement handler runs on a MICROTASK, so the synchronous
        // `vi.runAllTimers()` the sync cases use cannot observe it —
        // `runAllTimersAsync` flushes microtasks between timer ticks.
        await vi.runAllTimersAsync();

        // Documented listener order: the rejected item reports through `execute`
        // first, then the next item runs, reports through `execute`, and the drain
        // fires `complete` exactly once.
        expect(seen).toStrictEqual(['execute', 'second', 'execute', 'complete']);
        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute).toHaveBeenNthCalledWith(1, { queue: rejecting, response: undefined, error: failure });
        expect(execute).toHaveBeenNthCalledWith(2, { queue: second, response: undefined });
        expect(complete).toHaveBeenCalledTimes(1);
        expect(complete).toHaveBeenNthCalledWith(1);
        // Nothing is stranded — the old behaviour left `second` queued forever
        expect(queue().queue).toStrictEqual([]);
    });

    it('G1 — a rejected item in the middle of a batch does not skip the items behind it', async () => {
        const order: string[] = [];
        const reasons: unknown[] = [];
        const queue = functionQueue({
            // Only the rejection path carries an `error` key
            execute: (data: any) => {
                if ('error' in data) reasons.push(data.error);
            },
            complete: () => order.push('complete'),
        });

        const failure = new Error('middle');
        const first = async () => {
            order.push('first');
            return 'first-value';
        };
        const middle = () => Promise.reject(failure);
        const last = () => {
            order.push('last');
        };

        queue(first);
        queue(middle);
        queue(last);

        await vi.runAllTimersAsync();

        expect(order).toStrictEqual(['first', 'last', 'complete']);
        // The rejection reason is handed over verbatim (identity, not a copy)
        expect(reasons).toStrictEqual([failure]);
        expect(queue().queue).toStrictEqual([]);
    });

    it('G1 — a rejected item leaves no unhandled rejection behind', async () => {
        // Same capture convention the package already uses for escaped rejections
        // (src/script/async.test.ts:528-541): swap the process listeners for a
        // collecting one, flush, restore, then assert the exact list.
        const previousListeners = process.listeners('unhandledRejection') as unknown as ((...args: any[]) => void)[];
        const rejections: string[] = [];
        const listener = (reason: unknown) => {
            rejections.push(reason instanceof Error ? reason.message : String(reason));
        };
        process.removeAllListeners('unhandledRejection');
        process.on('unhandledRejection', listener);

        try {
            const queue = functionQueue();
            const failure = new Error('boom');

            queue(() => Promise.reject(failure));
            queue(() => undefined);

            await vi.runAllTimersAsync();
            // Extra ticks so node can publish a rejection nobody handled
            await vi.advanceTimersByTimeAsync(0);

            // The queue owns the rejection handler, so the reason travels through
            // the `execute` listener contract instead of the process
            expect(rejections).toStrictEqual([]);
            expect(failure.message).toBe('boom');
        } finally {
            process.removeAllListeners('unhandledRejection');
            previousListeners.forEach((existing) => process.on('unhandledRejection', existing));
        }
    });

    it('G1 boundary — a callback that throws synchronously still escapes the timer and stalls the queue', () => {
        const execute = vi.fn();
        const complete = vi.fn();
        const queue = functionQueue({ execute, complete });
        const order: string[] = [];

        const thrower = () => {
            order.push('thrower');
            throw new Error('sync-boom');
        };
        queue(thrower);
        queue(() => order.push('second'));

        // Deliberately NOT part of the async-rejection fix: a synchronous throw
        // happens inside the `functionDelay` timer callback, so it escapes through
        // `runAllTimers` and `busy` is never released.
        expect(() => vi.runAllTimers()).toThrow('sync-boom');
        expect(order).toStrictEqual(['thrower']);
        expect(execute).toHaveBeenCalledTimes(0);
        expect(complete).toHaveBeenCalledTimes(0);
        // The queue is wedged with the second item still pending
        expect(queue().queue.length).toBe(1);
    });

    it('G23 — kill() mid-flight: the in-flight async item still reports afterwards', async () => {
        const seen: string[] = [];
        const execute = vi.fn(() => seen.push('execute'));
        const complete = vi.fn(() => seen.push('complete'));
        const queue = functionQueue({ execute, complete });

        let release: () => void = () => {
            /* replaced by the gate executor below */
        };
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const inFlight = async () => {
            seen.push('start');
            await gate;
            seen.push('end');
        };

        queue(inFlight);
        await vi.runAllTimersAsync();
        expect(seen).toStrictEqual(['start']);

        // Kill the queue while the item is still awaiting its gate
        queue.kill();
        seen.push('killed');

        // PINNED CONTRACT (unchanged by the G1 fix, which only added the rejection
        // twin of the settlement handler): `kill()` clears pending items but does not
        // cancel a promise that is already in flight. When it settles, the registered
        // handler still fires `execute`, releases `busy`, and the now-empty queue
        // fires `complete` — so `kill()` is not silent for an in-flight item.
        release();
        await vi.runAllTimersAsync();

        expect(seen).toStrictEqual(['start', 'killed', 'end', 'execute', 'complete']);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenNthCalledWith(1, { queue: inFlight, response: undefined });
        expect(complete).toHaveBeenCalledTimes(1);
        expect(queue().queue).toStrictEqual([]);
    });
});
