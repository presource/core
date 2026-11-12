import { objectCreate } from '@presource/core';

describe('Object Create Test', () => {
    test('Basic Object Creation with Primitive values', () => {
        // Create 1 to 1 value with simple string
        expect(objectCreate('test', 'test')).toStrictEqual({ test: 'test' });
        // Create multiple to 1 value with number
        expect(objectCreate(5, 'test')).toStrictEqual({ 0: 'test', 1: 'test', 2: 'test', 3: 'test', 4: 'test' });
    });

    test('Using array object to create', () => {
        // Primitive to array or array to primitive
        expect(objectCreate(5, ['a', 'b', 'c', 'd', 'e'])).toStrictEqual({ 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e' });
        expect(objectCreate('key', ['a', 'b', 'c'])).toStrictEqual({ key: 'a' });

        // Array should match up. If not, Some will be truncated
        expect(objectCreate([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toStrictEqual({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 });
        expect(objectCreate([1, 2, 3, 4], [1, 2, 3, 4, 5])).toStrictEqual({ 1: 1, 2: 2, 3: 3, 4: 4 });
        expect(objectCreate([1, 2, 3, 4], 'value')).toStrictEqual({ 1: 'value', 2: 'value', 3: 'value', 4: 'value' });
        expect(objectCreate([1, 2, 3, 4], () => 'value')).toStrictEqual({
            1: 'value',
            2: 'value',
            3: 'value',
            4: 'value'
        });
        expect(objectCreate([1, 2, 3, 4], null)).toStrictEqual({ 1: null, 2: null, 3: null, 4: null });
        expect(objectCreate([1, 2, 3, 4], undefined)).toStrictEqual({
            1: undefined,
            2: undefined,
            3: undefined,
            4: undefined
        });
        expect(objectCreate([1, 2, 3, 4], true)).toStrictEqual({
            1: true,
            2: true,
            3: true,
            4: true
        });
    });

    test('Using with callback functions', () => {
        // Can be used with function to recreate
        expect(objectCreate([1, 2, 3, 4], [0, 1, 2, 3])).toStrictEqual(objectCreate([1, 2, 3, 4], ({ index }) => index));

        expect(objectCreate([1, 2, 3, 4], [1, 2, 3, 4])).toStrictEqual(objectCreate([1, 2, 3, 4], ({ value }) => value));

        // Any value can be returned with functions
        expect(objectCreate('key', () => 'value')).toStrictEqual({ key: 'value' });
        expect(objectCreate('key', () => [1, 2, 3, 4, 5])).toStrictEqual({ key: [1, 2, 3, 4, 5] });
        expect(objectCreate(3, () => [1, 2, 3, 4, 5])).toStrictEqual({
            0: [1, 2, 3, 4, 5],
            1: [1, 2, 3, 4, 5],
            2: [1, 2, 3, 4, 5]
        });
    });

    test('default case for keys with null', () => {
        expect(objectCreate(null as any, 'value')).toStrictEqual({});
    });

    test('default case for keys with undefined', () => {
        expect(objectCreate(undefined as any, 'value')).toStrictEqual({});
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/create.ts:39-88.
    // Keys are normalised by typeSwitch (number | string | array, everything else -> []); a
    // number is treated as a count and drives the direct loop at create.ts:79. Values are
    // resolved by a second typeSwitch (function | array-by-index | literal broadcast).
    // All expected values below were captured from the runtime, not assumed.
    // ----------------------------------------------------------------------------------------

    test('number keys produce "0".."n-1" in ascending order', () => {
        const result = objectCreate(4, 'v');
        expect(Object.keys(result)).toStrictEqual(['0', '1', '2', '3']);
        expect(result).toStrictEqual({ 0: 'v', 1: 'v', 2: 'v', 3: 'v' });
    });

    test('number keys hand the callback numeric values, not stringified keys', () => {
        // create.ts:79-81 hands the raw numeric counter to the callback as `value`, so it stays a
        // number and is never the stringified property key
        const args: unknown[] = [];
        const result = objectCreate(2, (data: any) => {
            args.push(data);
            return null;
        });

        expect(args).toStrictEqual([
            { value: 0, index: 0 },
            { value: 1, index: 1 }
        ]);
        // Result keys are the numeric-collapsed string forms of those values
        expect(result).toStrictEqual({ 0: null, 1: null });
    });

    test('string key hands the callback the key string at index 0', () => {
        const args: unknown[] = [];
        const result = objectCreate('solo', (data: any) => {
            args.push(data);
            return 'r';
        });

        expect(args).toStrictEqual([{ value: 'solo', index: 0 }]);
        expect(result).toStrictEqual({ solo: 'r' });
    });

    test('callback argument object contains exactly { value, index }', () => {
        const keys = objectCreate(1, (data: any) => Object.keys(data).join(','));
        expect(keys).toStrictEqual({ 0: 'value,index' });
    });

    test('array keys pass each element through untouched and collapse to property keys', () => {
        const args: unknown[] = [];
        const result = objectCreate([1, 'two', true, null, undefined], (data: any) => {
            args.push(data);
            return data.index;
        });

        // The raw element (with its original type) is what the callback receives
        expect(args).toStrictEqual([
            { value: 1, index: 0 },
            { value: 'two', index: 1 },
            { value: true, index: 2 },
            { value: null, index: 3 },
            { value: undefined, index: 4 }
        ]);
        // Property-key coercion produces the stringified key set
        expect(result).toStrictEqual({ 1: 0, two: 1, true: 2, null: 3, undefined: 4 });
    });

    test('object and array key elements are stringified into the result key', () => {
        expect(objectCreate([{}, { other: 1 }], 'v')).toStrictEqual({ '[object Object]': 'v' });
        expect(objectCreate([[1, 2]], 'v')).toStrictEqual({ '1,2': 'v' });
    });

    test('array values pair by index and keep element identity', () => {
        const first = { x: 1 };
        const values = [first, [2]];
        const result = objectCreate(['a', 'b', 'c'], values);

        // Missing pairs are present-but-undefined keys
        expect(result).toStrictEqual({ a: first, b: [2], c: undefined });
        expect(result.a).toBe(first);
    });

    test('literal object values broadcast by reference to every key', () => {
        const shared = { nested: true };
        const result = objectCreate(3, shared);

        expect(result).toStrictEqual({ 0: { nested: true }, 1: { nested: true }, 2: { nested: true } });
        expect(result[0]).toBe(shared);
        expect(result[1]).toBe(shared);
        expect(result[2]).toBe(shared);
    });

    test('empty keys array creates an empty object', () => {
        expect(objectCreate([], 'v')).toStrictEqual({});
        expect(objectCreate([], () => 'v')).toStrictEqual({});
        expect(objectCreate([], [])).toStrictEqual({});
    });

    test('number key count of zero creates an empty object', () => {
        expect(objectCreate(0, 'v')).toStrictEqual({});
    });

    test('invalid number counts collapse to zero keys', () => {
        // the numeric key branch clamps negatives/fractionals/NaN the same way arrayCreate does
        // (create.ts:51 mirrors array/create.ts:71)
        expect(objectCreate(-3, 'v')).toStrictEqual({});
        expect(objectCreate(NaN, 'v')).toStrictEqual({});
        expect(objectCreate(2.7, 'v')).toStrictEqual({ 0: 'v', 1: 'v' });
    });

    test('non iterable key types fall to the default case and produce an empty object', () => {
        expect(objectCreate(true as any, 'v')).toStrictEqual({});
        expect(objectCreate({ a: 1 } as any, 'v')).toStrictEqual({});
        expect(objectCreate((() => 1) as any, 'v')).toStrictEqual({});
    });

    test('duplicate keys collapse to a single entry', () => {
        // 1 and "1" are the same property key
        expect(objectCreate([1, '1'], 'x')).toStrictEqual({ 1: 'x' });
        // Later writes win for repeated string keys
        expect(objectCreate(['a', 'a'], ({ index }) => index)).toStrictEqual({ a: 1 });
    });

    test('sparse key arrays skip holes because forEach is used', () => {
        expect(objectCreate(['a', , 'b'], 'v')).toStrictEqual({ a: 'v', b: 'v' });
    });

    test('the keys array is consumed without being mutated', () => {
        const keys = ['a', 'b'];
        expect(objectCreate(keys, ({ index }) => index)).toStrictEqual({ a: 0, b: 1 });
        expect(keys).toStrictEqual(['a', 'b']);
    });

    test('function values returning undefined create present-but-undefined keys', () => {
        expect(objectCreate(2, () => undefined)).toStrictEqual({ 0: undefined, 1: undefined });
        expect(Object.keys(objectCreate(2, () => undefined))).toStrictEqual(['0', '1']);
    });
});
