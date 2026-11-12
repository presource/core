import { scriptPause } from '@presource/core';

describe('Pausing an async function', () => {
    // Fake timers make every delay assertion exact (no wall-clock sleeps).
    // `scriptPause` is now a single `setTimeout` inside the promise executor
    // (src/script/pause.ts:14-28), so driving the fake timer clock drives the pause —
    // the previous `promiseCreate` + `functionDelay` indirection is gone but the
    // observable schedule (one timer registered at call time) is identical.
    beforeEach(() => {
        vi.useFakeTimers();
    });

    // Real timers must come back for every other suite in this file/worker pool
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    // Testing if function is delayed correctly
    test('Script paused correctly', async () => {
        let settled = 'pending';
        let resolvedValue: unknown = 'not-settled';

        const pause = scriptPause(10_000).then((value) => {
            settled = 'resolved';
            resolvedValue = value;
        });

        // 1ms short of the delay: the pause promise has not settled
        await vi.advanceTimersByTimeAsync(9_999);
        expect(settled).toBe('pending');
        expect(resolvedValue).toBe('not-settled');

        // The final millisecond fires the scheduled resolve
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toBe('resolved');
        // scriptPause resolves with no value (nothing is passed to `resolve`)
        expect(resolvedValue).toBeUndefined();

        expect(await pause).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    // CONTRACT: exactly one pending timer backs a pause (src/script/pause.ts:26) — the
    // `promiseCreate`/`functionDelay` indirection it replaced also scheduled one, so this
    // pins the timer-count invariant against future re-scheduling regressions.
    test('A pause registers exactly one pending timer', () => {
        scriptPause(500);

        expect(vi.getTimerCount()).toBe(1);
    });

    test('Zero delay is still deferred to a timer tick', async () => {
        let settled = 'pending';

        const pause = scriptPause(0).then(() => {
            settled = 'resolved';
        });

        // The promise is pending until the timer queue is flushed, even at 0ms
        expect(settled).toBe('pending');

        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe('resolved');
        expect(await pause).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    test('Sequential pauses accumulate to the exact sum of their delays', async () => {
        const marks: string[] = [];

        const run = (async () => {
            await scriptPause(100);
            marks.push('first');
            await scriptPause(250);
            marks.push('second');
        })();

        // First pause lands at 100ms; the second is scheduled only afterwards
        await vi.advanceTimersByTimeAsync(100);
        expect(marks).toStrictEqual(['first']);

        // 249ms into the second pause: still waiting (100 + 249 = 349ms total)
        await vi.advanceTimersByTimeAsync(249);
        expect(marks).toStrictEqual(['first']);

        await vi.advanceTimersByTimeAsync(1);
        expect(marks).toStrictEqual(['first', 'second']);

        await run;
        expect(vi.getTimerCount()).toBe(0);
    });

    test('Concurrent pauses resolve at the longest delay, not the sum', async () => {
        const marks: string[] = [];

        // Both timers are registered at t=0, so the pair lands at max(100, 250)
        const all = Promise.all([scriptPause(100), scriptPause(250)]).then((values) => {
            marks.push('both');
            return values;
        });

        await vi.advanceTimersByTimeAsync(100);
        expect(marks).toStrictEqual([]);

        await vi.advanceTimersByTimeAsync(150);
        expect(marks).toStrictEqual(['both']);

        // Each pause resolves with undefined
        expect(await all).toStrictEqual([undefined, undefined]);
        expect(vi.getTimerCount()).toBe(0);
    });
});
