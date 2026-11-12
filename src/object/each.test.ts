import { objectEach, objectEachAsync } from './each';
import { scriptPause } from '@presource/core';

describe('Object Each', () => {
    const example = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6
    };

    // Testing Loop Through Object
    test('Loop Through Object', () => {
        let string = '';
        let number = 0;
        const result = objectEach(example, ({ key, value }) => {
            string += key;
            number += value;
        });
        expect(result).toBe(undefined);
        expect(string).toBe('abcdef');
        expect(number).toBe(21);
    });

    test('Return prematurely', () => {
        const result = objectEach(example, ({ value }) => {
            if (value >= 3) return value;
        });
        expect(result).toBe(3);
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/each.ts:41-77.
    // `getParams` builds ONE mutable argument object reused for every iteration; the loop
    // breaks on `result !== undefined`, so any defined return (even falsy) short-circuits.
    // ----------------------------------------------------------------------------------------

    test('callback receives the exact documented parameter object on every iteration', () => {
        const source = { a: 1, b: 2, c: 3 };
        const snapshots: unknown[] = [];

        const callback = (params: any) => {
            // Values are read out eagerly because `params` is a single shared object
            snapshots.push({
                array: params.array,
                key: params.key,
                value: params.value,
                index: params.index,
                object: params.object,
                length: params.length,
                result: params.result,
                isOwnCallback: params.callback === callback
            });
        };

        const result = objectEach(source, callback);

        expect(snapshots).toStrictEqual([
            {
                array: ['a', 'b', 'c'],
                key: 'a',
                value: 1,
                index: 0,
                object: source,
                length: 3,
                result: undefined,
                isOwnCallback: true
            },
            {
                array: ['a', 'b', 'c'],
                key: 'b',
                value: 2,
                index: 1,
                object: source,
                length: 3,
                result: undefined,
                isOwnCallback: true
            },
            {
                array: ['a', 'b', 'c'],
                key: 'c',
                value: 3,
                index: 2,
                object: source,
                length: 3,
                result: undefined,
                isOwnCallback: true
            }
        ]);
        expect(result).toBe(undefined);
    });

    test('the parameter object is the same reference for every iteration', () => {
        const refs: any[] = [];
        objectEach({ a: 1, b: 2, c: 3 }, (params) => {
            refs.push(params);
        });

        expect(refs.length).toBe(3);
        expect(refs[0]).toBe(refs[1]);
        expect(refs[1]).toBe(refs[2]);
        // After the loop the shared object has walked past the last index
        expect(refs[0].index).toBe(3);
        expect(refs[0].key).toBe('c');
        expect(refs[0].value).toBe(3);
        expect(refs[0].result).toBe(undefined);
    });

    test('result is always undefined inside the callback because a defined result breaks the loop', () => {
        const seen: unknown[] = [];
        const result = objectEach({ a: 1, b: 2, c: 3 }, (params) => {
            seen.push(params.result);
            return undefined;
        });

        expect(seen).toStrictEqual([undefined, undefined, undefined]);
        expect(result).toBe(undefined);
    });

    test('short-circuits on the first defined result even when that result is falsy', () => {
        // each.ts:73 breaks on `!== undefined`, so 0 / '' / false / NaN / null all stop the loop
        const breakers = { zero: 0, emptyString: '', falseValue: false, nan: NaN, nullValue: null };
        const outcomes: Record<string, { calls: number; returned: unknown }> = {};

        Object.keys(breakers).forEach((name) => {
            const breaker = (breakers as any)[name];
            let calls = 0;
            const returned = objectEach({ a: 1, b: 2, c: 3 }, () => {
                calls++;
                return breaker;
            });
            outcomes[name] = { calls, returned };
        });

        expect(outcomes).toStrictEqual({
            zero: { calls: 1, returned: 0 },
            emptyString: { calls: 1, returned: '' },
            falseValue: { calls: 1, returned: false },
            nan: { calls: 1, returned: NaN },
            nullValue: { calls: 1, returned: null }
        });
    });

    test('partial run stops before the remaining keys and leaves index at the breaking iteration', () => {
        const visited: string[] = [];
        let finalParams: any = null;

        const result = objectEach({ a: 1, b: 2, c: 3 }, (params) => {
            visited.push(String(params.key));
            finalParams = params;
            return params.index === 1 ? 'stop' : undefined;
        });

        expect(visited).toStrictEqual(['a', 'b']);
        expect(result).toBe('stop');
        // A break skips the `index++` step, so the shared params stay on the breaking iteration
        expect(finalParams.index).toBe(1);
        expect(finalParams.key).toBe('b');
        expect(finalParams.value).toBe(2);
        expect(finalParams.result).toBe('stop');
    });

    test('empty object returns undefined without calling the callback', () => {
        let calls = 0;
        expect(
            objectEach({}, () => {
                calls++;
                return 'never';
            })
        ).toBe(undefined);
        expect(calls).toBe(0);
    });

    test('null and undefined inputs throw from Object.keys', () => {
        expect(() => objectEach(null as any, () => undefined)).toThrow(TypeError);
        expect(() => objectEach(null as any, () => undefined)).toThrow('Cannot convert undefined or null to object');
        expect(() => objectEach(undefined as any, () => undefined)).toThrow('Cannot convert undefined or null to object');
    });

    test('number primitives iterate zero keys while string primitives iterate their indexes', () => {
        let numberCalls = 0;
        expect(
            objectEach(5 as any, () => {
                numberCalls++;
                return undefined;
            })
        ).toBe(undefined);
        expect(numberCalls).toBe(0);

        const stringParams: unknown[] = [];
        const stringResult = objectEach('ab' as any, (params: any) => {
            stringParams.push({ key: params.key, value: params.value, index: params.index, length: params.length, array: params.array });
            return params.value === 'b' ? params.key : undefined;
        });

        expect(stringParams).toStrictEqual([
            { key: '0', value: 'a', index: 0, length: 2, array: ['0', '1'] },
            { key: '1', value: 'b', index: 1, length: 2, array: ['0', '1'] }
        ]);
        expect(stringResult).toBe('1');
    });

    test('iteration follows Object.keys order (integer-like keys first, ascending)', () => {
        const order: string[] = [];
        objectEach({ 2: 'two', 10: 'ten', 1: 'one', b: 'bee', a: 'ay' } as any, ({ key }) => {
            order.push(String(key));
        });

        expect(order).toStrictEqual(['1', '2', '10', 'b', 'a']);
    });

    test('inherited properties are not iterated', () => {
        const prototype = { inherited: 'proto' };
        const instance = Object.create(prototype) as { own: number } & { inherited: string };
        instance.own = 2;

        const keys: string[] = [];
        objectEach(instance, ({ key }) => {
            keys.push(String(key));
        });

        expect(keys).toStrictEqual(['own']);
    });

    test('keys added during iteration are not visited because the key list is snapshotted', () => {
        const source = { a: 1 } as Record<string, number>;
        const visited: string[] = [];

        const result = objectEach(source, ({ key }) => {
            visited.push(String(key));
            if (source.b === undefined) source.b = 2;
            return undefined;
        });

        expect(visited).toStrictEqual(['a']);
        expect(result).toBe(undefined);
        expect(source).toStrictEqual({ a: 1, b: 2 });
    });

    test('frozen objects iterate normally since the loop only reads', () => {
        expect(objectEach(Object.freeze({ a: 1, b: 2 }), () => undefined)).toBe(undefined);
    });
});

describe('Object each Async', () => {
    const example = { a: 'apple', b: 'banana', c: 'cat', d: 'dog', e: 'electron' };
    test('Loop through correctly', async () => {
        let count = 0;
        await objectEachAsync(example, async () => {
            count++;
        });
        expect(count).toBe(5);
    });

    test('Waiting for others to resolve before continuing', async () => {
        const result: string[] = [];
        let count = 0;
        await objectEachAsync(example, async ({ value }) => {
            count++;
            await scriptPause(100);
            result.push(value);
        });
        expect(count).toBe(5);
        expect(result).toStrictEqual(['apple', 'banana', 'cat', 'dog', 'electron']);
    });

    test('Async callback short-circuits on non-undefined return', async () => {
        let count = 0;
        const res = await objectEachAsync(example, async ({ value }) => {
            count++;
            if (value === 'cat') return value;
        });
        expect(count).toBe(3);
        expect(res).toBe('cat');
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/each.ts:89-99 (same shared params object as the
    // sync loop, but every callback result is awaited before the `!== undefined` break check).
    // ----------------------------------------------------------------------------------------

    test('async callback receives the same exact parameter object as the sync loop', async () => {
        const source = { a: 1, b: 2 };
        const snapshots: unknown[] = [];

        const callback = (params: any) => {
            snapshots.push({
                array: params.array,
                key: params.key,
                value: params.value,
                index: params.index,
                object: params.object,
                length: params.length,
                result: params.result,
                isOwnCallback: params.callback === callback
            });
            return Promise.resolve(undefined);
        };

        const result = await objectEachAsync(source, callback);

        expect(snapshots).toStrictEqual([
            {
                array: ['a', 'b'],
                key: 'a',
                value: 1,
                index: 0,
                object: source,
                length: 2,
                result: undefined,
                isOwnCallback: true
            },
            {
                array: ['a', 'b'],
                key: 'b',
                value: 2,
                index: 1,
                object: source,
                length: 2,
                result: undefined,
                isOwnCallback: true
            }
        ]);
        expect(result).toBe(undefined);
    });

    test('async loop awaits each iteration sequentially', async () => {
        const events: string[] = [];
        const result = await objectEachAsync({ a: 1, b: 2, c: 3 }, async ({ key }) => {
            events.push(`start:${key}`);
            await scriptPause(String(key) === 'a' ? 30 : 0);
            events.push(`end:${key}`);
        });

        expect(events).toStrictEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c']);
        expect(result).toBe(undefined);
    });

    test('async short-circuits on defined falsy results', async () => {
        const breakers = { zero: 0, emptyString: '', falseValue: false };
        const outcomes: Record<string, { calls: number; returned: unknown }> = {};

        for (const name of Object.keys(breakers)) {
            const breaker = (breakers as any)[name];
            let calls = 0;
            const returned = await objectEachAsync({ a: 1, b: 2, c: 3 }, async () => {
                calls++;
                return breaker;
            });
            outcomes[name] = { calls, returned };
        }

        expect(outcomes).toStrictEqual({
            zero: { calls: 1, returned: 0 },
            emptyString: { calls: 1, returned: '' },
            falseValue: { calls: 1, returned: false }
        });
    });

    test('async empty object resolves to undefined without calling the callback', async () => {
        let calls = 0;
        expect(
            await objectEachAsync({}, async () => {
                calls++;
                return 'never';
            })
        ).toBe(undefined);
        expect(calls).toBe(0);
    });

    test('async null input rejects with the same Object.keys error', async () => {
        await expect(objectEachAsync(null as any, async () => undefined)).rejects.toThrow(TypeError);
        await expect(objectEachAsync(null as any, async () => undefined)).rejects.toThrow(
            'Cannot convert undefined or null to object'
        );
    });

    test('async promise-valued defined results also short-circuit', async () => {
        let calls = 0;
        const result = await objectEachAsync({ a: 1, b: 2 }, async () => {
            calls++;
            return calls === 1 ? await Promise.resolve('early') : undefined;
        });

        expect(calls).toBe(1);
        expect(result).toBe('early');
    });

    test('deleting a not-yet-visited key still fires the callback with an undefined value', () => {
        // G17: `getParams` snapshots `Object.keys(object)` before the loop starts (each.ts:42)
        // and the loop re-reads `params.object[params.key]` on every step (each.ts:71). A key
        // deleted before its turn is therefore still visited - with `value: undefined` - and the
        // index simply advances, so the visit sequence is exactly the originally snapshotted keys.
        const source: any = { a: 1, b: 2, c: 3 };
        const visits: unknown[] = [];

        const returned = objectEach(source, ({ key, value, index, length }) => {
            visits.push([key, value, index, length]);
            if (key === 'a') delete source.b;
        });

        expect(visits).toStrictEqual([
            ['a', 1, 0, 3],
            ['b', undefined, 1, 3],
            ['c', 3, 2, 3]
        ]);
        // `length` stayed at the snapshot size while the object itself shrank
        expect(source).toStrictEqual({ a: 1, c: 3 });
        // No callback returned a defined value, so nothing short-circuited
        expect(returned).toBeUndefined();
    });

    test('keys created mid-iteration are never visited because the key list is a snapshot', () => {
        // G17 companion: the same snapshot that keeps deleted keys visible hides new ones, so
        // `length`/`array` never grow during the walk.
        const source: any = { a: 1 };
        const keys: unknown[] = [];

        objectEach(source, ({ key, index, length }) => {
            keys.push([key, index, length]);
            if (key === 'a') source.b = 2;
        });

        expect(keys).toStrictEqual([['a', 0, 1]]);
        expect(source).toStrictEqual({ a: 1, b: 2 });
    });
});
