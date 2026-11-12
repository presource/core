/**
 * Script pause / delay utility.
 *
 * Exposes a single helper that returns a promise settling after a fixed
 * time span, making it easy to `await` a delay.
 */

/**
 * Return a promise that resolves after the given number of milliseconds.
 *
 * @param time - Delay duration in milliseconds.
 * @returns A promise that resolves (with `undefined`) after `time` ms.
 */
export const scriptPause = (time: number) => {
    // PERF (L15): a single `setTimeout` inside the promise executor replaces the
    // `promiseCreate` control object, the `functionDelay` wrapper, and the `{ delay }`
    // argument object + closure `functionDelay` builds for every call
    // (src/function/delay.ts:17-27 is itself just `setTimeout(() => cb({ delay }), delay)`).
    //
    // Behaviour-preserving, and the fake-timer contract in src/script/pause.test.ts still
    // holds: exactly one timer is registered synchronously at call time, so a 0ms pause is
    // deferred to a timer tick, sequential pauses accumulate, concurrent ones take the max,
    // and the promise always settles with `undefined` (no value is passed to `resolve`).
    // `src/function/delay.ts` is intentionally untouched.
    return new Promise<any>((resolve) => {
        setTimeout(resolve, time);
    });
};
