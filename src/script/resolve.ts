/**
 * Polling / retry utilities.
 *
 * Provides a helper that repeatedly invokes a callback until it returns
 * a valid (non-null, non-undefined) value, with configurable retry count
 * and delay between attempts.
 */

import { isValid } from '../is';
import { loopForAsync } from '../loop';
import { scriptPause } from './pause';

/** Arguments object passed to the callback on each poll attempt. */
type Arguments = {
    /** The current attempt number (0-based). */
    count: number;
};

/** Callback invoked on each poll attempt; should return a valid (non-null/undefined) result to resolve. */
type Callback = (args: Arguments) => any;

/**
 * Signature for {@link scriptResolve}.
 *
 * @param resolveFunction - The function to poll. Returns a value considered "resolved" when `isValid` passes.
 * @param maxRetries - Maximum number of poll attempts. Defaults to 40.
 * @param delayInterval - Milliseconds to wait between consecutive attempts. Defaults to 50.
 * @returns The first valid value returned by `resolveFunction`, or `undefined` after exhausting retries.
 */
export type ScriptResolve = (resolveFunction: Callback, maxRetries?: number, delayInterval?: number) => Promise<any>;

/**
 * Repeatedly call `callback` until it returns a valid value or retries are exhausted.
 *
 * On each iteration the attempt counter (`count`) is incremented. If the
 * callback returns a value that passes `isValid`, that value is returned
 * immediately. Otherwise execution pauses for `delay` milliseconds and tries again.
 *
 * @param callback - The function to poll.
 * @param retries - Maximum number of attempts. Defaults to 40.
 * @param delay - Milliseconds to wait between attempts. Defaults to 50.
 * @returns The first valid value from `callback`, or `undefined` if all retries fail.
 */
export const scriptResolve: ScriptResolve = async (callback, retries = 40, delay = 50) => {
    const params = {
        count: 0
    };

    return await loopForAsync(retries, async ({ count }) => {
        params.count = count;
        const value = await callback(params);
        if (isValid(value)) return value;
        await scriptPause(delay);
    });
};
