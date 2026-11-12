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
// TODO: pending - No cancel/abort API. setTimeout handle not exposed to callers
export const functionDelay = (callback: (...args: any[]) => void, delay: number = 0) =>
    setTimeout(() => {
        // Calling the Call back
        callback({
            // Delay Function. Can use to call itself
            delay: (time: number) => {
                // Recursive. Delay it for Later
                functionDelay(callback, time);
            }
        });
    }, delay);
