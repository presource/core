import { scriptResolve } from '@presource/core';

describe('Callback resolver', () => {
    // `scriptResolve` polls via `loopForAsync` + `scriptPause`
    // (src/script/resolve.ts:44-55), so every attempt boundary is a timer.
    // Fake timers make the attempt/timing assertions exact.
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    test('wait until value is resolved', async () => {
        // Returning the Apple — the first attempt already resolves, no timer is used
        const firstSpy = vi.fn(() => 'apple');

        expect(await scriptResolve(firstSpy)).toBe('apple');
        expect(firstSpy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);

        let counter = 0;
        let settled: unknown = 'pending';
        const resolved = scriptResolve(({ count }) => {
            // Increasing the Counter
            if (count < 10) {
                counter++; // Increment to check
                return;
            }
            return 'banana';
        }).then((value) => {
            settled = value;
        });

        // Attempt `k` fires at k * 50ms (default delay). Advancing 450ms therefore
        // lands attempts with counts 0..9 — ten failed attempts, all still retrying.
        await vi.advanceTimersByTimeAsync(9 * 50);
        expect(settled).toBe('pending');
        expect(counter).toBe(10);

        // Attempt with count 10 lands at 500ms and is the first valid value
        await vi.advanceTimersByTimeAsync(50);
        expect(settled).toBe('banana');
        expect(counter).toBe(10);

        await resolved;
        expect(vi.getTimerCount()).toBe(0);
    });

    // CONTRACT: the callback payload is exactly `{ count }` and the SAME object is
    // reused for every attempt (src/script/resolve.ts:45-51) — only `count` moves.
    test('Callback receives one shared payload carrying only the attempt count', async () => {
        const payloads: { keys: string[]; count: number; sameRecord: boolean }[] = [];
        let firstParams: unknown = null;
        let settled: unknown = 'pending';

        const resolved = scriptResolve(
            (params) => {
                if (firstParams === null) firstParams = params;
                payloads.push({ keys: Object.keys(params), count: params.count, sameRecord: params === firstParams });
                if (params.count === 2) return 'done';
                return undefined;
            },
            5,
            20,
        ).then((value) => {
            settled = value;
        });

        // Attempt 0 is dispatched synchronously, before any timer exists
        expect(payloads).toStrictEqual([{ keys: ['count'], count: 0, sameRecord: true }]);

        // The pause for attempt 0 is only scheduled once its microtask continuation runs
        await vi.advanceTimersByTimeAsync(0);
        expect(vi.getTimerCount()).toBe(1);

        await vi.advanceTimersByTimeAsync(40);
        expect(settled).toBe('done');
        expect(payloads).toStrictEqual([
            { keys: ['count'], count: 0, sameRecord: true },
            { keys: ['count'], count: 1, sameRecord: true },
            { keys: ['count'], count: 2, sameRecord: true },
        ]);
        expect(vi.getTimerCount()).toBe(0);

        await resolved;
    });

    // CONTRACT: validity is nullish-only (`isValid` = not null/undefined,
    // src/is/valid.ts:18). Every other value — including falsy ones — is a result.
    test.each([0, false, '', {}] as const)('Valid non-nullish value %s resolves on the first attempt', async (value) => {
        const spy = vi.fn(() => value);

        expect(await scriptResolve(spy, 5, 50)).toBe(value);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    // CONTRACT: `null` and `undefined` are the only retry triggers, and a valid
    // value is returned verbatim (0 here) without scheduling another pause.
    test('Retries on null and undefined, then returns the first valid value verbatim', async () => {
        const sequence: (null | undefined | number)[] = [null, undefined, 0];
        const counts: number[] = [];
        let settled: unknown = 'pending';

        const resolved = scriptResolve(
            ({ count }) => {
                counts.push(count);
                return sequence[count];
            },
            6,
            30,
        ).then((value) => {
            settled = value;
        });

        // attempt 0 (null) at t=0
        expect(counts).toStrictEqual([0]);

        // attempt 1 (undefined) at t=30
        await vi.advanceTimersByTimeAsync(30);
        expect(counts).toStrictEqual([0, 1]);
        expect(settled).toBe('pending');

        // attempt 2 (0) at t=60 — valid, so the loop stops immediately
        await vi.advanceTimersByTimeAsync(30);
        expect(counts).toStrictEqual([0, 1, 2]);
        expect(settled).toBe(0);
        expect(vi.getTimerCount()).toBe(0);

        await resolved;
    });

    // CONTRACT: exhausted retries resolve with `undefined` after exactly `retries`
    // attempts, and the final attempt still burns one delay (total = retries * delay).
    test('Exhausting custom retries resolves undefined after exactly that many attempts', async () => {
        const counts: number[] = [];
        let settled: unknown = 'pending';
        let settleCount = 0;

        const resolved = scriptResolve(
            ({ count }) => {
                counts.push(count);
                return undefined;
            },
            3,
            50,
        ).then((value) => {
            settleCount++;
            settled = value;
        });

        // Attempts fire at t=0, 50, 100 -> all 3 attempts are in by t=100
        await vi.advanceTimersByTimeAsync(100);
        expect(counts).toStrictEqual([0, 1, 2]);
        expect(settled).toBe('pending');
        expect(settleCount).toBe(0);

        // The third attempt still pauses for one more interval (t=150) before the loop ends
        await vi.advanceTimersByTimeAsync(50);
        expect(settled).toBeUndefined();
        expect(settleCount).toBe(1);
        expect(counts).toStrictEqual([0, 1, 2]);
        expect(vi.getTimerCount()).toBe(0);

        await resolved;
    });

    // CONTRACT: the documented defaults are 40 attempts spaced 50ms apart.
    test('Default retries (40) and delay (50ms) are honoured', async () => {
        const counts: number[] = [];
        let settled: unknown = 'pending';

        const resolved = scriptResolve(({ count }) => {
            counts.push(count);
            return null;
        }).then((value) => {
            settled = value;
        });

        const expectedCounts = Array.from({ length: 40 }, (_, index) => index);

        // 39 * 50ms lands the 40th (final) attempt; its trailing pause is still pending
        await vi.advanceTimersByTimeAsync(39 * 50);
        expect(counts).toStrictEqual(expectedCounts);
        expect(settled).toBe('pending');

        await vi.advanceTimersByTimeAsync(50);
        expect(counts).toStrictEqual(expectedCounts);
        expect(settled).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);

        await resolved;
    });

    // CONTRACT: a custom delay is used verbatim between attempts (5ms here).
    test('Custom delay spacing is used verbatim between attempts', async () => {
        const marks: string[] = [];
        let settled: unknown = 'pending';

        const resolved = scriptResolve(
            ({ count }) => {
                marks.push(`attempt:${count}`);
                if (count === 2) return 'third-time';
                return undefined;
            },
            10,
            5,
        ).then((value) => {
            settled = value;
        });

        // A 4ms step is not enough: attempt 1 needs the full 5ms interval
        await vi.advanceTimersByTimeAsync(4);
        expect(marks).toStrictEqual(['attempt:0']);
        expect(settled).toBe('pending');

        await vi.advanceTimersByTimeAsync(1);
        expect(marks).toStrictEqual(['attempt:0', 'attempt:1']);

        await vi.advanceTimersByTimeAsync(5);
        expect(marks).toStrictEqual(['attempt:0', 'attempt:1', 'attempt:2']);
        expect(settled).toBe('third-time');
        expect(vi.getTimerCount()).toBe(0);

        await resolved;
    });

    // CONTRACT: `retries` is the total attempt budget — `retries: 1` polls once,
    // burns one delay, then resolves with undefined.
    test('Single retry budget polls exactly once', async () => {
        const spy = vi.fn(() => undefined);
        let settled: unknown = 'pending';

        const resolved = scriptResolve(spy, 1, 25).then((value) => {
            settled = value;
        });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(settled).toBe('pending');

        // Flush the attempt's microtask continuation so its pause gets scheduled
        await vi.advanceTimersByTimeAsync(0);
        expect(vi.getTimerCount()).toBe(1);

        await vi.advanceTimersByTimeAsync(25);
        expect(settled).toBeUndefined();
        expect(spy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);

        await resolved;
    });

    // ------------------------------------------------------------------
    // G16 PINNED CONTRACT — a THROWING predicate is not a retry trigger.
    // The JSDoc (src/script/resolve.ts:22-43) only documents "returns the first valid
    // value, or `undefined` after exhausting retries"; it never mentions throwing. The
    // actual behaviour is that the error escapes `loopForAsync` (src/loop/for.ts:129-137)
    // and the returned promise REJECTS with the original error, on the FIRST attempt,
    // with no further polling and no delay scheduled.
    // ------------------------------------------------------------------
    test('A synchronously throwing predicate rejects immediately after one attempt', async () => {
        const spy = vi.fn(() => {
            throw new Error('poll-boom');
        });

        await expect(scriptResolve(spy, 5, 20)).rejects.toThrow('poll-boom');
        // Exactly one attempt is consumed — retries do not swallow the throw
        expect(spy).toHaveBeenCalledTimes(1);
        // The throw escapes before `scriptPause`, so no retry timer is ever created
        expect(vi.getTimerCount()).toBe(0);
    });

    test('An async predicate rejection rejects with the original error', async () => {
        const spy = vi.fn(async () => {
            throw new TypeError('async-poll-boom');
        });

        // The awaited callback rejects -> loopForAsync rejects -> scriptResolve rejects
        await expect(scriptResolve(spy, 3, 20)).rejects.toThrow(TypeError);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('A throw on a later attempt stops the remaining retries', async () => {
        const counts: number[] = [];
        const spy = vi.fn(({ count }: { count: number }) => {
            counts.push(count);
            if (count === 2) throw new Error('late-boom');
            return undefined;
        });

        // Both settlements are observed at creation time, so the rejection can never be
        // reported as an unhandled rejection while the fake clock is being advanced.
        const outcome = scriptResolve(spy, 6, 30).then(
            (value) => `resolved:${String(value)}`,
            (error: Error) => `rejected:${error.message}`,
        );

        // Attempt 0 fires synchronously; every later attempt is gated by a (fake) retry timer
        expect(counts).toStrictEqual([0]);
        await vi.advanceTimersByTimeAsync(30);
        expect(counts).toStrictEqual([0, 1]);

        await vi.advanceTimersByTimeAsync(30);
        // Attempt 2 throws: attempts 3..5 never run and the promise rejects
        expect(counts).toStrictEqual([0, 1, 2]);
        expect(await outcome).toBe('rejected:late-boom');
        expect(spy).toHaveBeenCalledTimes(3);
        expect(vi.getTimerCount()).toBe(0);
    });
});
