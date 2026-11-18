/**
 * Script chain – sequential callback executor.
 *
 * Accepts an object whose values are async callbacks and returns an ACCESSOR — at
 * runtime a plain function carrying one trigger method per callback key (calling the
 * accessor itself does nothing and yields `null`; docs/issues/0003 tracks that type
 * mismatch, since the declared `RelayObject<T>` return type advertises a promise).
 * Calling a trigger key enqueues the corresponding callback; callbacks execute one at
 * a time in the order they were invoked. Every trigger returns the run's "relay": a
 * promise that settles when all queued callbacks have completed — it resolves with
 * `undefined`, or REJECTS with the first error thrown/rejected by a callback in that
 * run (the run itself keeps draining — a failing callback does not skip the ones
 * queued behind it).
 *
 * The relay instance is created lazily on the first invocation and cleared once the
 * queue drains, so the next trigger builds a fresh one.
 */

import { functionQueue } from '../function';
import { objectMap, objectUpdate } from '../object';
import { promiseCreate } from '../promise';

/**
 * A trigger function bound to a single callback key.
 * Invoking it enqueues the associated callback and returns the relay.
 */
type CallbackTrigger<T extends {}> = (...input: any[]) => RelayObject<T>;

/**
 * The awaitable relay handed back by every trigger call.
 * Awaits completion of all queued callbacks, while also exposing
 * every callback key as an invokable method. Note: this is the TYPE
 * `scriptChain` returns, but at runtime the top-level value is the trigger
 * accessor (a plain function); the real relay object only exists while a run
 * is in flight (docs/issues/0003).
 */
type RelayObject<T extends {}> = Promise<any> & { [key in keyof T]: CallbackTrigger<T> };

/** Arguments passed to each registered callback. */
type Arguments = {
    /** The accessor object (its per-key triggers let a callback enqueue further calls). */
    script: RelayObject<{}>;
    /** Arguments that were passed to the trigger invocation. */
    args: any[];
};

/** Signature for a single registered callback. */
type Callback = (args: Arguments) => any;

/**
 * Signature for {@link scriptChain}.
 *
 * @param list - Object mapping string keys to callback functions.
 * @returns The trigger accessor (a plain function whose properties are the triggers) —
 *          typed as the relay, but it is NOT the promise: a trigger CALL returns the
 *          awaitable relay, which settles when the run drains (resolve `undefined`, or
 *          reject with the first callback error).
 */
export type ScriptChain = <T extends { [key: string]: Callback }>(list: T) => RelayObject<T>;

/**
 * Create a sequential callback relay from a plain object of callbacks.
 *
 * Each property of `list` becomes a method on the returned accessor.
 * Invoking a method enqueues the callback; callbacks run one after
 * another. Each method returns that run's relay, which settles when the
 * queue is empty: it resolves with `undefined`, or rejects with the first
 * error a callback threw or rejected with during that run. As with any
 * promise, a relay that rejects must be awaited/caught by the caller.
 *
 * @param list - Object whose values are async callbacks.
 * @returns The accessor (function with one trigger method per key), typed as the
 *          relay — awaiting the accessor itself awaits `null`, i.e. nothing.
 */
export const scriptChain: ScriptChain = (list) => {
    // The accessor itself. Calling it directly is a stub that returns `null`; the only
    // working entry points are the per-key triggers attached below via `objectUpdate`.
    const script: any = () => {
        return null;
    };
    // Lazily created per run: `relay` is the awaitable drain signal handed back by
    // every trigger, `queue` is the sequential executor behind it
    let relay: any = null;
    let queue: any = null;

    // Wrap each user callback so that invocation triggers lazy instance creation
    const callbacks = objectMap(list, ({ value: callback }: any) => {
        return (...args: any[]) => {
            generateInstance();

            // The async wrapper turns a SYNCHRONOUS throw inside the user callback
            // into a rejected promise, which is what `functionQueue` needs in order
            // to observe the failure (see the `ASYNC REJECTIONS` note in src/function/queue.ts).
            queue(async () => {
                const params = { script, args };
                await callback(params);
            });

            return relay;
        };
    });

    /** Lazily create the relay promise and backing queue on first use. */
    const generateInstance = () => {
        if (relay) return;

        const promiseControl: any = {};
        relay = promiseCreate(promiseControl);
        objectUpdate(relay, callbacks);

        // First failure recorded for this run, kept in a BOX so the FLAG (never the
        // reason value) decides whether the relay rejects: `Promise.reject(undefined)`
        // must still reject the relay with reason `undefined`, and a value test would
        // read that reason as "no failure" and resolve the run instead.
        let failure: { has: boolean; reason: any } = { has: false, reason: undefined };

        queue = functionQueue({
            // `functionQueue` never drops an async rejection on the floor: the
            // rejected item is reported here as `{ queue, response: undefined,
            // error }` and the queue keeps draining. Record the FIRST error only —
            // the run continues, but the relay reports one reason.
            execute: (payload: any) => {
                if (failure.has) return;
                // Failure is detected by the PRESENCE of the `error` KEY, not by its value:
                // src/function/queue.ts:19-22 guarantees the key exists only on the rejection
                // path, so `Promise.reject(undefined)` is still a failure. The previous
                // `payload.error !== undefined` value check made that reason indistinguishable
                // from a normal completion and resolved the relay (JSDoc contradiction).
                // `payload &&` stays as null-safety for the no-listener path — `in` throws
                // when the right-hand side is nullish or not an object.
                if (payload && 'error' in payload) {
                    failure = { has: true, reason: payload.error };
                }
            },
            complete: () => {
                const { resolve, reject } = promiseControl;
                relay = null;
                queue = null;
                // DEFECT (fixed): a rejecting callback used to leave the relay pending
                // forever (the queue died before `complete` could run), so awaiting
                // any relay hung — and every later run hung with it. Now the drain
                // always happens and the relay settles with the run's outcome:
                // reject with the recorded reason when a callback failed (that reason
                // may itself be `undefined`), resolve with undefined otherwise.
                if (failure.has) reject(failure.reason);
                else resolve();
            }
        });
    };

    objectUpdate(script, callbacks);
    return script;
};
