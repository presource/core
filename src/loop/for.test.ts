import { loopFor, loopForAsync } from '@presource/core';

// These are basic cases loopFor
describe('For Loop (Basic)', () => {
    test('Should loop until the end', () => {
        let count = 0;
        loopFor(10, () => {
            count++;
        });
        expect(count).toBe(10);
    });

    test('Loop until end, return undefined', () => {
        const result = loopFor(10, () => {});
        expect(result).toBe(undefined);
    });

    test('Loop break prematurely, return result', () => {
        const result = loopFor(10, ({ index }) => {
            if (index >= 5) return index;
        });
        expect(result).toBe(5);
    });

    // CONTRACT: one mutable record object is handed to every iteration, so the
    // exact counter values observed inside the callback are the contract.
    // Implementation: src/loop/for.ts:90-99 (`record.result = callback(record)`
    // then `record.index++; record.count++;`).
    test('Params record identity is stable and carries the exact counters', () => {
        const seen: unknown[] = [];
        const snapshots: Record<string, unknown>[] = [];

        const callback = (params: any) => {
            seen.push(params);
            snapshots.push({
                index: params.index,
                count: params.count,
                length: params.length,
                result: params.result,
                callback: params.callback,
            });
        };

        const result = loopFor(3, callback);

        expect(result).toBeUndefined();
        expect(seen.length).toBe(3);
        // Same object reference for all three iterations (index/count mutate in place)
        expect(seen[1]).toBe(seen[0]);
        expect(seen[2]).toBe(seen[0]);
        // `callback` is echoed back on the params object (src/loop/for.ts:61-76)
        expect(snapshots).toStrictEqual([
            { index: 0, count: 0, length: 3, result: undefined, callback },
            { index: 1, count: 1, length: 3, result: undefined, callback },
            { index: 2, count: 2, length: 3, result: undefined, callback },
        ]);
    });

    // CONTRACT: the break happens BEFORE `index`/`count` are incremented, so the
    // snapshot taken inside the breaking callback shows the counters of that pass
    // (index 1 / count 1), and the loop never reaches index 2.
    test('Break with value returns it verbatim and freezes the counters at the breaking pass', () => {
        const snapshots: Record<string, unknown>[] = [];

        const result = loopFor(4, (params) => {
            snapshots.push({ index: params.index, count: params.count, length: params.length, result: params.result });
            if (params.index === 1) return 'halt';
        });

        expect(result).toBe('halt');
        expect(snapshots).toStrictEqual([
            { index: 0, count: 0, length: 4, result: undefined },
            { index: 1, count: 1, length: 4, result: undefined },
        ]);
    });

    test('Zero length never runs the body and returns undefined', () => {
        const runs: string[] = [];
        const result = loopFor(0, () => {
            runs.push('body');
            return undefined;
        });
        // `while (record.index < record.length)` -> 0 < 0 is false (src/loop/for.ts:92)
        expect(runs).toStrictEqual([]);
        expect(result).toBeUndefined();
    });

    test('Start at or beyond length never runs the body and returns undefined', () => {
        const runs: number[] = [];

        const atLength = loopFor(
            3,
            (params) => {
                runs.push(params.index);
            },
            3,
        );
        const beyondLength = loopFor(
            3,
            (params) => {
                runs.push(params.index);
            },
            5,
        );

        expect(runs).toStrictEqual([]);
        expect(atLength).toBeUndefined();
        expect(beyondLength).toBeUndefined();
    });

    // CONTRACT: `start` seeds `index` while `length` stays the stop bound, so a
    // negative start yields (length - start) passes; `count` counts passes only.
    test('Negative start iterates every index up to length while count tracks passes', () => {
        const snapshots: Record<string, unknown>[] = [];

        const result = loopFor(
            2,
            (params) => {
                snapshots.push({ index: params.index, count: params.count, length: params.length });
            },
            -3,
        );

        expect(result).toBeUndefined();
        expect(snapshots).toStrictEqual([
            { index: -3, count: 0, length: 2 },
            { index: -2, count: 1, length: 2 },
            { index: -1, count: 2, length: 2 },
            { index: 0, count: 3, length: 2 },
            { index: 1, count: 4, length: 2 },
        ]);
    });

    test('Negative start still honours an early break', () => {
        const seen: number[] = [];

        const result = loopFor(
            2,
            (params) => {
                seen.push(params.index);
                if (params.index === 0) return 'stopped';
            },
            -3,
        );

        expect(result).toBe('stopped');
        expect(seen).toStrictEqual([-3, -2, -1, 0]);
    });

    // CONTRACT: `record.result` is only ever assigned a value that is `undefined`
    // (a defined value breaks before the next pass), so the callback can never
    // observe a defined `result`.
    test('params.result is undefined on every pass because only undefined is ever stored', () => {
        const observed: unknown[] = [];
        let passes = 0;

        const result = loopFor(4, (params) => {
            observed.push(params.result);
            passes++;
            if (passes === 2) return 0;
            return undefined;
        });

        expect(observed).toStrictEqual([undefined, undefined]);
        expect(result).toBe(0);
    });

    // Every value that is not `undefined` — including every falsy one — is the
    // success signal and is returned verbatim (src/loop/for.ts:94).
    test.each([0, false, '', null, NaN] as const)('Falsy-but-defined return %p breaks and is returned verbatim', (haltValue) => {
        const indices: number[] = [];

        const result = loopFor(5, (params) => {
            indices.push(params.index);
            if (params.index === 2) return haltValue;
        });

        expect(Object.is(result, haltValue)).toBe(true);
        expect(indices).toStrictEqual([0, 1, 2]);
    });

    // ------------------------------------------------------------------
    // G20 PINNED CONTRACT — degenerate counts. The guard is `record.index < record.length`
    // (src/loop/for.ts:92) starting from `index = 0`, so a negative length is simply
    // never satisfied and `NaN` makes the comparison `false` outright. Both run the body
    // zero times and return `record.result`, which stays at its initial `undefined`.
    // ------------------------------------------------------------------
    test.each([-3, NaN])('Length %p never runs the body and returns undefined', (length) => {
        const runs: number[] = [];

        const result = loopFor(length, (params) => {
            runs.push(params.index);
            return undefined;
        });

        expect(runs).toStrictEqual([]);
        expect(result).toBeUndefined();
    });

    // `Infinity` is the opposite edge: the guard is always satisfied and an
    // `undefined`-returning callback never breaks, so the loop is unbounded.
    test('Length Infinity relies on the callback breaking out of the loop', () => {
        const indices: number[] = [];

        const result = loopFor(Infinity, (params) => {
            indices.push(params.index);
            if (params.index === 3) return 'escaped';
            return undefined;
        });

        expect(result).toBe('escaped');
        expect(indices).toStrictEqual([0, 1, 2, 3]);
    });
});

// These are advance cases.
describe('Loop For (Advance)', () => {
    test('Loop break prematurely due to re-nesting', () => {
        let count = 0;
        const result = loopFor(10, (data) => {
            const { callback, index } = data;
            if (index >= 5) return index;
            count++;
            // Overwriting Index
            return callback({ ...data, index: 5 });
        });
        expect(count).toBe(1);
        expect(result).toBe(5);
    });

    test('Loop break prematurely due to overwriting params', () => {
        let count = 0;
        // Scanning the Result
        const result = loopFor(10, (data) => {
            count++;
            // Updating the Data Object Directly
            data.length = 0; // Set Length to Zero will automatically break the loop
        });
        expect(count).toBe(1);
        expect(result).toBeUndefined();
    });

    // CONTRACT: re-invoking `params.callback(params)` (same mutable record, only
    // `index` swapped) returns the inner value, which the outer pass then returns
    // as its own result -> the loop breaks with that value.
    test('params.callback re-invocation on the same record short-circuits the outer pass', () => {
        const observed: Record<string, unknown>[] = [];

        const result = loopFor(6, (params) => {
            observed.push({ index: params.index, count: params.count });
            if (params.index === 1) {
                // Same record shape, only `index` differs -> the inner pass runs at index 4
                return params.callback({ ...params, index: 4 });
            }
            if (params.index === 4) return 'inner';
            return undefined;
        });

        expect(result).toBe('inner');
        expect(observed).toStrictEqual([
            { index: 0, count: 0 },
            { index: 1, count: 1 },
            { index: 4, count: 1 },
        ]);
    });
});

/** Test cases for async function */

describe('Loop For Async Usage', () => {
    test('Loop correctly', async () => {
        let count = 0;
        const result = await loopForAsync(10, async () => {
            count++;
        });
        expect(count).toBe(10);
        expect(result).toBeUndefined();
    });

    test('Loop correctly with break prematurely', async () => {
        let count = 0;
        const result = await loopForAsync(10, async () => {
            count++;
            if (count > 5) {
                return false;
            }
        });
        expect(count).toBe(6);
        // `false` is a defined value -> exact break contract, not merely falsy
        expect(result).toBe(false);
    });

    // CONTRACT: the async loop `await`s every callback before the next pass, so
    // start/end markers strictly interleave per iteration (src/loop/for.ts:129-137).
    test('Awaits callbacks sequentially and reuses one params record', async () => {
        const order: string[] = [];
        const seen: unknown[] = [];
        const snapshots: Record<string, unknown>[] = [];

        const callback = async (params: any) => {
            seen.push(params);
            order.push(`start:${params.index}`);
            await Promise.resolve();
            order.push(`end:${params.index}`);
            snapshots.push({ index: params.index, count: params.count, length: params.length, result: params.result, callback: params.callback });
        };

        const result = await loopForAsync(3, callback);

        expect(result).toBeUndefined();
        expect(order).toStrictEqual(['start:0', 'end:0', 'start:1', 'end:1', 'start:2', 'end:2']);
        expect(seen[1]).toBe(seen[0]);
        expect(seen[2]).toBe(seen[0]);
        expect(snapshots).toStrictEqual([
            { index: 0, count: 0, length: 3, result: undefined, callback },
            { index: 1, count: 1, length: 3, result: undefined, callback },
            { index: 2, count: 2, length: 3, result: undefined, callback },
        ]);
    });

    // CONTRACT: a Promise that resolves to a defined value breaks the loop, and
    // the value is returned verbatim. The for-update (`record.index++`) does not
    // run on a break, so the counters stay at the breaking pass.
    test('Short-circuits on a Promise resolving to a defined value', async () => {
        const snapshots: Record<string, unknown>[] = [];

        const result = await loopForAsync(5, async (params) => {
            snapshots.push({ index: params.index, count: params.count, result: params.result });
            if (params.index === 2) return Promise.resolve('halted');
            return Promise.resolve(undefined);
        });

        expect(result).toBe('halted');
        expect(snapshots).toStrictEqual([
            { index: 0, count: 0, result: undefined },
            { index: 1, count: 1, result: undefined },
            { index: 2, count: 2, result: undefined },
        ]);
    });

    test('Zero length or start beyond length never runs the body', async () => {
        const runs: string[] = [];

        const zero = await loopForAsync(0, async () => {
            runs.push('zero');
        });
        const beyond = await loopForAsync(
            3,
            async () => {
                runs.push('beyond');
            },
            5,
        );

        expect(runs).toStrictEqual([]);
        expect(zero).toBeUndefined();
        expect(beyond).toBeUndefined();
    });

    // CONTRACT: an async rejection escapes the loop and stops further passes; the
    // returned promise rejects with the original error.
    test('Propagates a callback rejection and skips the remaining passes', async () => {
        const indices: number[] = [];

        const run = loopForAsync(4, async (params) => {
            indices.push(params.index);
            if (params.index === 1) throw new Error('boom');
        });

        await expect(run).rejects.toThrow('boom');
        expect(indices).toStrictEqual([0, 1]);
    });

    // CONTRACT: same as the sync loop — a defined return breaks, so the next pass
    // can never observe a defined `result`.
    test('params.result stays undefined on every pass even with awaited returns', async () => {
        const observed: unknown[] = [];

        const result = await loopForAsync(5, async (params) => {
            observed.push(params.result);
            if (observed.length === 3) return 'stop';
        });

        expect(observed).toStrictEqual([undefined, undefined, undefined]);
        expect(result).toBe('stop');
    });

    // CONTRACT: async parity with the sync loop (G20) — negative and NaN counts fail the
    // `record.index < record.length` guard outright (src/loop/for.ts:131), so the body
    // never runs and the promise resolves with the untouched initial `record.result`.
    test.each([-3, NaN])('Async length %p never runs the body and resolves undefined', async (length) => {
        const callback = vi.fn(() => undefined);

        const result = await loopForAsync(length, callback);

        expect(callback).toHaveBeenCalledTimes(0);
        expect(result).toBeUndefined();
    });
});
