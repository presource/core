import { arrayCreate, arrayEach, arrayEachAsync, scriptPause } from '@presource/core';

// The parameter object is shared across iterations and mutated in place, so every test
// below records a plain snapshot of the fields it asserts on. `result` is part of the
// runtime shape as well (it carries the callback's own return value back out).
const DOCUMENTED_KEYS = ['value', 'index', 'length', 'callback', 'result'];

describe('Basic Usage of arrayEach', () => {
    test('Loop through every value and add together', () => {
        let total = 0;
        arrayEach([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ({ value }) => {
            total += value;
        });
        // Expect Summation to Equal up
        expect(total).toBe(55);

        let count = 0;
        let message = '';
        arrayEach(['s', 'u', 'c', 'c', 'e', 's', 's'], ({ value, index }) => {
            message += value;
            count += index;
        });

        expect(message).toBe('success');
        expect(count).toBe(21);
    });

    // Expect End prematurely and return result

    test('Return Proper Value', () => {
        // Scanning Through Array. If Value hit greater than 5. Return it. So it is 6
        expect(
            arrayEach([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ({ value }) => {
                if (value > 5) return value;
            })
        ).toBe(6);
    });

    describe('Callback parameter contract', () => {
        test('Every iteration receives { value, index, length, callback } with exact values', () => {
            const seen: any[] = [];
            const callback = (args: any) => {
                seen.push({
                    keys: Object.keys(args),
                    value: args.value,
                    index: args.index,
                    length: args.length,
                    // `callback` is the callback function itself, so a nested call is possible.
                    sameCallback: args.callback === callback,
                });
            };

            const result = arrayEach(['x', 'y', 'z'], callback);

            expect(seen).toStrictEqual([
                { keys: DOCUMENTED_KEYS, value: 'x', index: 0, length: 3, sameCallback: true },
                { keys: DOCUMENTED_KEYS, value: 'y', index: 1, length: 3, sameCallback: true },
                { keys: DOCUMENTED_KEYS, value: 'z', index: 2, length: 3, sameCallback: true },
            ]);
            // Nothing returned means the iteration result is `undefined`.
            expect(result).toBeUndefined();
        });

        test('Holes in a sparse array are iterated as `undefined` values', () => {
            const list: any[] = [];
            list[2] = 'tail';
            const visited: any[] = [];

            const result = arrayEach(list, ({ index, value }) => {
                visited.push([index, value]);
            });

            expect(visited).toStrictEqual([
                [0, undefined],
                [1, undefined],
                [2, 'tail'],
            ]);
            expect(result).toBeUndefined();
        });

        test('An empty list returns `undefined` and never calls the callback', () => {
            const callback = vi.fn();
            expect(arrayEach([], callback)).toBeUndefined();
            expect(callback.mock.calls).toStrictEqual([]);
        });

        test('The loop bound is the captured `length`, so pushing mid-iteration does not extend it', () => {
            const list = [1, 2];
            const visited: any[] = [];

            arrayEach(list, ({ index, value }) => {
                // `length` stays at the snapshot taken before the first call (2) while the
                // real array grows to 3 — the new tail element is never visited.
                visited.push([index, value, list.length]);
                if (index === 0) list.push(3);
            });

            expect(visited).toStrictEqual([
                [0, 1, 2],
                [1, 2, 3],
            ]);
            expect(list).toStrictEqual([1, 2, 3]);
        });
    });

    describe('Short-circuit contract', () => {
        test('The first non-`undefined` result is returned and stops iteration', () => {
            const visited: number[] = [];
            const result = arrayEach([1, 2, 3, 4], ({ index }) => {
                visited.push(index);
                if (index === 1) return 'first';
                if (index === 2) return 'second';
            });

            expect(result).toBe('first');
            expect(visited).toStrictEqual([0, 1]);
        });

        test('An explicit `undefined` return continues the iteration', () => {
            const visited: number[] = [];
            const result = arrayEach([1, 2, 3], ({ index }) => {
                visited.push(index);
                return undefined;
            });

            expect(visited).toStrictEqual([0, 1, 2]);
            expect(result).toBeUndefined();
        });

        test('Falsy-but-defined returns still short-circuit (the guard is `!== undefined`)', () => {
            // `0`
            const zeroVisited: number[] = [];
            const zeroResult = arrayEach([1, 2, 3], ({ index }) => {
                zeroVisited.push(index);
                if (index === 1) return 0;
            });
            expect(zeroResult).toBe(0);
            expect(zeroVisited).toStrictEqual([0, 1]);

            // empty string (last index, so nothing is skipped but the value is still returned)
            const emptyVisited: number[] = [];
            const emptyResult = arrayEach([1, 2, 3], ({ index }) => {
                emptyVisited.push(index);
                if (index === 2) return '';
            });
            expect(emptyResult).toBe('');
            expect(emptyVisited).toStrictEqual([0, 1, 2]);

            // `false`
            const falseVisited: number[] = [];
            const falseResult = arrayEach([1, 2, 3], ({ index }) => {
                falseVisited.push(index);
                if (index === 0) return false;
            });
            expect(falseResult).toBe(false);
            expect(falseVisited).toStrictEqual([0]);

            // `null`
            const nullVisited: number[] = [];
            const nullResult = arrayEach([1, 2, 3], ({ index }) => {
                nullVisited.push(index);
                if (index === 1) return null;
            });
            expect(nullResult).toBeNull();
            expect(nullVisited).toStrictEqual([0, 1]);
        });

        test('Overwriting `params.length` ends the loop immediately', () => {
            let count = 0;
            const result = arrayEach([1, 2, 3], (params) => {
                count++;
                params.length = 0;
            });
            expect(count).toBe(1);
            expect(result).toBeUndefined();
        });

        test('The `callback` parameter re-invokes the same callback with the same params object', () => {
            let calls = 0;
            const callback = (args: any) => {
                calls++;
                // Re-enter once with the shared params object, then wrap the inner answer.
                if (calls === 1) return `outer(${args.callback(args)})`;
                return `inner:${args.value}`;
            };

            const result = arrayEach([7], callback);

            expect(result).toBe('outer(inner:7)');
            expect(calls).toBe(2);
        });
    });
});

// Advance Usage of arrayEach
describe('Advance usage of arrayEach', () => {
    test('Prematurely End Loop', () => {
        let count = 0;
        arrayEach(arrayCreate(12), (data) => {
            // Incrementing Count
            count++;
            // Set Data.length to 0. Automatically Stop
            data.length = 0;
        });
        // Exepect One to Go Through
        expect(count).toBe(1);
    });
});

// Async Usage of arrayEach
describe('Async Usage of arrayEach', () => {
    // Testing Async callback
    test('Async Callback', async () => {
        let count = 0;
        await arrayEachAsync(arrayCreate(12), async () => {
            count++;
        });
        expect(count).toBe(12);
    });

    test('Async callback with', async () => {
        let count = 0;
        const result: any[] = [];
        await arrayEachAsync(arrayCreate(12), async ({ index }) => {
            count++;
            await scriptPause(100);
            result.push(index);
        });
        expect(count).toBe(12);
        expect(result).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('Async callback short-circuits on non-undefined return', async () => {
        let count = 0;
        const res = await arrayEachAsync([1, 2, 3, 4, 5], async ({ value }) => {
            count++;
            if (value === 3) return value;
        });
        expect(count).toBe(3);
        expect(res).toBe(3);
    });

    test('Returns a promise even when the list is empty, and never calls the callback', async () => {
        const callback = vi.fn();
        const pending = arrayEachAsync([], callback);

        expect(pending).toBeInstanceOf(Promise);
        await expect(pending).resolves.toBeUndefined();
        expect(callback.mock.calls).toStrictEqual([]);
    });

    test('Every iteration receives the same parameter object as the sync variant', async () => {
        const seen: any[] = [];
        const callback = (args: any) => {
            seen.push({
                keys: Object.keys(args),
                value: args.value,
                index: args.index,
                length: args.length,
                sameCallback: args.callback === callback,
            });
        };

        const result = await arrayEachAsync(['x', 'y'], callback);

        expect(seen).toStrictEqual([
            { keys: DOCUMENTED_KEYS, value: 'x', index: 0, length: 2, sameCallback: true },
            { keys: DOCUMENTED_KEYS, value: 'y', index: 1, length: 2, sameCallback: true },
        ]);
        expect(result).toBeUndefined();
    });

    test('Callbacks are awaited one at a time, in order', async () => {
        const order: number[] = [];
        const result = await arrayEachAsync([30, 10, 20], async ({ value }) => {
            // Each callback settles slower than the next one would start, so a concurrent
            // implementation would produce [10, 20, 30].
            await scriptPause(value);
            order.push(value);
        });

        expect(order).toStrictEqual([30, 10, 20]);
        expect(result).toBeUndefined();
    });

    test('A promise resolving to `undefined` continues the iteration', async () => {
        const visited: number[] = [];
        const result = await arrayEachAsync([1, 2, 3], async ({ index }) => {
            visited.push(index);
            return Promise.resolve(undefined);
        });

        expect(visited).toStrictEqual([0, 1, 2]);
        expect(result).toBeUndefined();
    });

    test('Falsy-but-defined resolved values short-circuit the async loop too', async () => {
        const zeroVisited: number[] = [];
        const zeroResult = await arrayEachAsync([1, 2, 3], async ({ index }) => {
            zeroVisited.push(index);
            if (index === 1) return 0;
        });
        expect(zeroResult).toBe(0);
        expect(zeroVisited).toStrictEqual([0, 1]);

        const falseVisited: number[] = [];
        const falseResult = await arrayEachAsync([1, 2, 3], async ({ index }) => {
            falseVisited.push(index);
            if (index === 0) return false;
        });
        expect(falseResult).toBe(false);
        expect(falseVisited).toStrictEqual([0]);

        const emptyVisited: number[] = [];
        const emptyResult = await arrayEachAsync([1, 2, 3], async ({ index }) => {
            emptyVisited.push(index);
            if (index === 2) return '';
        });
        expect(emptyResult).toBe('');
        expect(emptyVisited).toStrictEqual([0, 1, 2]);
    });

    test('A rejected callback aborts the iteration and rejects the returned promise', async () => {
        const visited: number[] = [];
        const pending = arrayEachAsync([1, 2, 3], async ({ index }) => {
            visited.push(index);
            if (index === 1) throw new Error('async-boom');
        });

        await expect(pending).rejects.toThrow('async-boom');
        expect(visited).toStrictEqual([0, 1]);
    });
});
