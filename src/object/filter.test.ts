import { objectFilter } from '@presource/core';

describe('Usage of objectFilter', () => {
    // Sample object
    const sample = {
        a: 'apple',
        b: 'banana',
        c: 'cat',
        d: 'dog',
        e: undefined,
        f: null
    };

    test('Can be used to filter out invalid values', () => {
        // Filtered out Invalid Values
        const filtered = objectFilter(sample, ({ value }) => value);
        // The Expected Result should be
        const expected = { a: 'apple', b: 'banana', c: 'cat', d: 'dog' };
        // Test
        expect(filtered).toStrictEqual(expected);
    });

    test('Can be used to selective', () => {
        // Only Return the First 4 values
        const filtered = objectFilter(sample, ({ index }) => index < 4);
        // The Expected Result should be
        const expected = { a: 'apple', b: 'banana', c: 'cat', d: 'dog' };
        // Test
        expect(filtered).toStrictEqual(expected);
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/filter.ts:17-37. The predicate receives the
    // full objectEach parameter object (filter.ts:33 forwards `data` untouched), keeping only
    // truthy predicate results, and the accumulator is a brand new plain object.
    // ----------------------------------------------------------------------------------------

    test('predicate receives the exact objectEach parameter object on every key', () => {
        const source = { a: 1, b: 'two', c: false };
        const snapshots: unknown[] = [];

        const predicate = ({ index }: { index: number }) => index !== 1;
        const result = objectFilter(source, (params: any) => {
            snapshots.push({
                keys: Object.keys(params).sort(),
                index: params.index,
                key: params.key,
                value: params.value,
                length: params.length,
                array: params.array,
                result: params.result,
                isSource: params.object === source,
                // filter.ts wraps the predicate in its own objectEach callback, so `callback`
                // is the internal wrapper and never the predicate passed in here
                isPredicate: params.callback === predicate
            });
            return predicate(params);
        });

        expect(snapshots).toStrictEqual([
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                index: 0,
                key: 'a',
                value: 1,
                length: 3,
                array: ['a', 'b', 'c'],
                result: undefined,
                isSource: true,
                isPredicate: false
            },
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                index: 1,
                key: 'b',
                value: 'two',
                length: 3,
                array: ['a', 'b', 'c'],
                result: undefined,
                isSource: true,
                isPredicate: false
            },
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                index: 2,
                key: 'c',
                value: false,
                length: 3,
                array: ['a', 'b', 'c'],
                result: undefined,
                isSource: true,
                isPredicate: false
            }
        ]);
        expect(result).toStrictEqual({ a: 1, c: false });
    });

    test('only truthy predicate results are kept and the order follows the source', () => {
        const source = { z: 1, a: 2, 10: 3, 1: 4, m: 5 };
        const result = objectFilter(source, ({ index }) => index % 2 === 0);

        // Object.keys puts integer-like keys first in ascending order, and the result keeps it
        expect(Object.keys(result)).toStrictEqual(['1', 'z', 'm']);
        expect(result).toStrictEqual({ 1: 4, z: 1, m: 5 });
    });

    test('falsy predicate return values drop the key, including 0 and empty string', () => {
        // The predicate result is used in a boolean position, so index 0 is dropped
        const result = objectFilter({ a: 1, b: 2, c: 3 }, ({ index }) => index);
        expect(result).toStrictEqual({ b: 2, c: 3 });

        expect(objectFilter({ a: 1, b: 2 }, () => '')).toStrictEqual({});
        expect(objectFilter({ a: 1, b: 2 }, () => 0)).toStrictEqual({});
        expect(objectFilter({ a: 1, b: 2 }, () => undefined)).toStrictEqual({});
        expect(objectFilter({ a: 1, b: 2 }, () => NaN)).toStrictEqual({});
        expect(objectFilter({ a: 1, b: 2 }, () => null)).toStrictEqual({});
    });

    test('keeping everything still returns a new object and does not mutate the source', () => {
        const source = { a: 1, b: 2 };
        const result = objectFilter(source, () => true);

        expect(result).toStrictEqual({ a: 1, b: 2 });
        expect(result).not.toBe(source);
        expect(Object.keys(source)).toStrictEqual(['a', 'b']);
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);

        const dropped = objectFilter(source, () => false);
        expect(dropped).toStrictEqual({});
        expect(Object.keys(dropped)).toStrictEqual([]);
    });

    test('kept values are carried over by reference including functions and arrays', () => {
        const list = [1, 2];
        const fn = () => 'kept';
        const source = { list, fn, other: 1 };
        const result = objectFilter(source, ({ key }) => key !== 'other');

        expect(result.list).toBe(list);
        expect(result.fn).toBe(fn);
        expect(result.other).toBeUndefined();
    });

    test('empty source objects filter to an empty object without calling the predicate', () => {
        let calls = 0;
        const result = objectFilter({}, () => {
            calls++;
            return true;
        });

        expect(result).toStrictEqual({});
        expect(calls).toBe(0);
    });

    test('null source throws from the underlying Object.keys call', () => {
        expect(() => objectFilter(null as any, () => true)).toThrow('Cannot convert undefined or null to object');
    });
});
