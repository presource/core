/**
 * Delay utilities — wraps `setTimeout` to schedule a callback with an optional
 * delay, and provides a `delay` helper on the argument object so the callback
 * can re-schedule itself.
 */

/**
 * Schedules `callback` to run after `delay` milliseconds. The callback receives
 * an object with a `delay(time)` method to re-schedule itself for a later time.
 *
 * @param callback - The function to invoke after the delay. It receives a single
 *                   argument `{ delay: (time: number) => void }` for rescheduling.
 * @param delay - Milliseconds to wait before invoking the callback. Defaults to 0
 *                (next macrotask tick).
 */
// TODO: pending - No cancel API for a SELF-RESCHEDULING callback. The initial
// `setTimeout` handle IS returned to the caller, but no test pins that identity: the
// only related pin (src/function/delay.test.ts, "the callback return value is not
// surfaced to the caller") just rules the callback's own return value out. The handle
// the `delay(time)` helper below creates is discarded, so a callback that keeps
// re-scheduling itself cannot be stopped from outside (docs/issues/0011, P3).
export const functionDelay = (callback: (...args: any[]) => void, delay: number = 0) =>
    setTimeout(() => {
        // Invoke the callback with the single `{ delay }` argument object; its return
        // value is dropped (`setTimeout` swallows the arrow's result anyway).
        callback({
            // Reschedule helper — the callback can call this to run itself again later
            delay: (time: number) => {
                // Recursive: a brand new, independent timer (its handle is not returned)
                functionDelay(callback, time);
            }
        });
    }, delay);
