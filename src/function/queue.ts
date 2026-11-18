/**
 * Function queue — executes callbacks sequentially, one at a time, in the order
 * they were added. Supports async (Promise-returning) callbacks, per-item delays,
 * and lifecycle listeners for execution and completion events.
 */

import { functionDelay } from './delay';
import { isPromise } from '../is';

import { objectUpdate } from '../object';

/**
 * Optional lifecycle callbacks for queue events.
 *
 * Payload contract for `execute` (the queue has no separate error channel —
 * see docs/issues/0002 "Out of scope"):
 * - fulfilled / synchronous item: `{ queue: <callback>, response: <result> }`
 * - REJECTED async item:          `{ queue: <callback>, response: undefined, error: <reason> }`
 *
 * `error` is only present on the rejection path, so pre-existing consumers that
 * read `response` keep working; the reason is surfaced here (and nowhere else)
 * instead of being swallowed or dropped into `process` as an unhandled rejection.
 */
type ListenerHandler = {
    // Fires once per executed item — including a rejected async item (see the payload note above)
    execute?: (data: any) => any;
    // Fires when the queue drains. A deferred `processQueue` that finds an empty queue
    // fires it again (pinned in src/function/queue.test.ts, 'done completes the queue
    // immediately'), and `done()` fires it directly right after clearing the queue.
    complete?: (data: any) => any;
};

/** Arguments passed to each queued callback. */
type Arguments = {
    queue: QueueFunction;
};

/** A callback enqueued for sequential execution. */
type CallbackFunction = (args: Arguments) => any;

/**
 * The queue accessor — a callback enqueues; NO arguments reads the live internal
 * memory (`{ queue, on }`); `.kill()` / `.done()` clear or force-complete it. The
 * runtime allows that no-arg read, which the call signature below does not declare.
 */
type QueueFunction = {
    (callback: CallbackFunction): any;
    kill: () => any;
    done: () => any;
};

/**
 * Creates a sequential function queue. Each enqueued callback runs to completion
 * before the next one starts. Promises are awaited automatically. Items can carry
 * a `delay` property to postpone their execution. The `busy` flag prevents
 * concurrent processing.
 *
 * ASYNC REJECTIONS: an item whose promise rejects is treated as a
 * finished item. The queue releases `busy`, reports the failure through the
 * `execute` listener as `{ queue, response: undefined, error }` (see
 * {@link ListenerHandler}), and keeps draining the remaining items. The reason
 * is never rethrown and the original promise always carries a rejection handler,
 * so a rejected item cannot leave an `unhandledRejection` behind and cannot wedge
 * the queue. This mirrors the established precedent in `src/task/completion.ts`
 * (a rejected task releases its slot and the drain continues).
 *
 * Note: the queue has no error channel of its own — without an `execute`
 * listener the reason is observed by nobody (tracked as out-of-scope in
 * docs/issues/0002). A callback that throws SYNCHRONOUSLY (instead of returning
 * a rejected promise) still escapes through the timer callback and stalls the
 * queue; that path is unchanged and pinned by tests.
 *
 * @param listener - Optional object with `execute` (fires after each callback,
 *                   including rejected ones) and `complete` (fires when the queue
 *                   drains) hooks.
 * @returns A callable queue accessor. Invoke it with a callback to enqueue,
 *          or call `.kill()` / `.done()` to clear or finish the queue.
 */
export const functionQueue = (listener: ListenerHandler = {}): QueueFunction => {
    // Setting up the Memory — shared state for the queue
    const memory: any = { queue: [], on: listener };
    let pointer = 0;
    let busy = false;

    // Continue Queue Function — called when the current item finishes
    const continueQueue = (result: any) => {
        memory.on.execute?.(result);
        busy = false;
        processQueue();
    };

    // The Main Processor Function — picks up the next queued item and runs it
    const processQueue = () => {
        // Guard Clause. Busy. Return immediately
        if (busy) return;
        // Set Busy to True to prevent repeating processor
        busy = true;

        // Get Queue List
        const { queue } = memory;
        // If there is any queue available, process
        if (queue.length) {
            // Extract Delay Function
            const { delay } = queue[0];

            // Triggering Function in Delay Mode
            // The zero/`delay` timer is what lets a whole batch be enqueued before the
            // first item runs: `processQueue` only reaches the item on the next tick.
            functionDelay(() => {
                // Get the Script
                const callback: any = queue.shift();
                // Set the pointer to 0 — after the shift, the next enqueue splices at the
                // front of what is left, which is how an item's own children run first.
                pointer = 0;

                // Script Must be Valid
                if (callback) {
                    // Getting the Response. The item is handed `{ queue, current }`: the
                    // accessor itself plus the item being run. Note the local `Arguments`
                    // type only declares `queue`, so `current` is undocumented surface
                    // (reported, not changed here).
                    const response = callback({ queue: accessorFunction, current: callback });
                    // If response is valid, and it is a promise
                    if (response && isPromise(response)) {
                        // Chaining Response Promise — wait for async resolution before proceeding.
                        // BOTH settlements must be handled. With only the fulfilment
                        // handler, a rejected item never reached `continueQueue`:
                        // `busy` (closure state unlocked only by `continueQueue`) stayed
                        // true, the remaining items sat in `memory.queue` forever, every
                        // later `execute`/`complete` fired against a drained queue, and
                        // the rejection escaped as an `unhandledRejection`.
                        // The rejection handler mirrors the fulfilment one: report the
                        // item (with `error`) through the same `execute` contract, which
                        // also releases `busy` and re-enters the processor.
                        response.then(
                            (res) => continueQueue({ queue: callback, response: res }),
                            (error: any) =>
                                continueQueue({ queue: callback, response: undefined, error }),
                        );
                    } else {
                        // Continue Queue — synchronous result, move on immediately
                        continueQueue({ queue: callback, response });
                    }
                }
            }, delay || 0);
        } else {
            // There is no more queue item left
            functionDelay(() => {
                // Trigger complete — `completeScriptObject` clears the queue first,
                // then fires the `complete` listener (when one was registered).
                completeScriptObject(memory);
            });
        }
    };

    // The Accessor Function — adds items to the queue or returns internal memory
    const accessorFunction: any = (script?: any): any => {
        // Return the Memory Object.
        // TODO: pending - calling the accessor with NO arguments returns the LIVE internal
        // memory object (`{ queue, on }`), not a copy: callers can read and mutate
        // `memory.queue` directly (unshift / push / truncating `length`) and the processor
        // honours those edits, because `processQueue` reads the same array on every pass.
        // Kept as a marker only for traceability (docs/issues/0011 inventory): the exposure
        // is deliberate — docs/issues/0002 keeps it and the tests rely on it (`scriptChain`
        // only ever uses the enqueue form) — so this is a decided contract, not open work.
        if (script === undefined) return memory;
        // Adding Queue To List — splice at pointer so new items slot in ahead of later ones
        memory.queue.splice(pointer, 0, script);
        pointer++;
        // Process the Queue — defer processing so rapid enqueues can batch together
        functionDelay(processQueue);
        // Return the optional setting controller — allows post-enqueue configuration
        return {
            // Set the Delay
            delay: (count: number) => (script.delay = count),
            // Set the id value
            id: (id: any) => (script.id = id)
        };
    };

    objectUpdate(accessorFunction, {
        kill: () => destroyScriptObject(memory),
        done: () => completeScriptObject(memory)
    });

    // Return the Accessor Function
    return accessorFunction;
};

/** Completes the queue: clears items and fires the `complete` listener. */
const completeScriptObject = (memory: any) => {
    const complete = memory.on.complete;
    destroyScriptObject(memory);
    if (complete) complete();
};

/** Kills the queue: clears all pending items without firing the `complete` listener. */
const destroyScriptObject = (memory: any) => {
    // Clear the Queue
    objectUpdate(memory, { queue: [] });
};
