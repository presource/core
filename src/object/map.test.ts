import { objectMap, objectMapKeys } from '@presource/core';

describe('Object Mapping Function (similiar to Array.map', () => {
    const example = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6
    };

    test('Remapping Number. Increase value by one', () => {
        const result = objectMap(example, ({ value }) => value + 1);
        expect(result).toEqual({ a: 2, b: 3, c: 4, d: 5, e: 6, f: 7 });
    });

    test('Remapping Number. Decrease value by one', () => {
        const result = objectMap(example, ({ value }) => value - 1);
        expect(result).toEqual({ a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 });
    });

    test('Remapping value. Change Value to Key', () => {
        const result = objectMap(example, ({ key }) => key);
        expect(result).toEqual({ a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f' });
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/map.ts:30-47. The callback receives the full
    // objectEach parameter object, keys are always preserved, and the accumulator is new.
    // ----------------------------------------------------------------------------------------

    test('map callback receives the exact parameter object on every key', () => {
        const source = { a: 1, b: 2, c: 3 };
        const snapshots: unknown[] = [];

        const mapper = ({ value }: { value: unknown }) => value;
        const result = objectMap(source, (params: any) => {
            snapshots.push({
                keys: Object.keys(params).sort(),
                key: params.key,
                value: params.value,
                index: params.index,
                length: params.length,
                array: params.array,
                result: params.result,
                isSource: params.object === source,
                // map.ts wraps the user mapper in its own objectEach callback
                isMapper: params.callback === mapper
            });
            return params.value;
        });

        expect(snapshots).toStrictEqual([
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                key: 'a',
                value: 1,
                index: 0,
                length: 3,
                array: ['a', 'b', 'c'],
                result: undefined,
                isSource: true,
                isMapper: false
            },
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                key: 'b',
                value: 2,
                index: 1,
                length: 3,
                array: ['a', 'b', 'c'],
                result: undefined,
                isSource: true,
                isMapper: false
            },
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                key: 'c',
                value: 3,
                index: 2,
                length: 3,
                array: ['a', 'b', 'c'],
                result: undefined,
                isSource: true,
                isMapper: false
            }
        ]);
        expect(result).toStrictEqual({ a: 1, b: 2, c: 3 });
    });

    test('map returns a new object, never mutates the source, and shares value references', () => {
        const nested = { deep: true };
        const source = { nested, other: 1 };
        const result = objectMap(source, ({ value }) => value);

        expect(result).not.toBe(source);
        expect(result.nested).toBe(nested);
        expect(source).toStrictEqual({ nested: { deep: true }, other: 1 });
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    });

    test('map keeps every key including when the mapper returns undefined', () => {
        const result = objectMap({ a: 1, b: 2 }, () => undefined);

        expect(result).toStrictEqual({ a: undefined, b: undefined });
        expect(Object.keys(result)).toStrictEqual(['a', 'b']);
    });

    test('map preserves the Object.keys ordering of the source', () => {
        const result = objectMap({ b: 1, a: 2, 2: 3 }, ({ key }) => key);

        expect(Object.keys(result)).toStrictEqual(['2', 'b', 'a']);
        expect(result).toStrictEqual({ 2: '2', b: 'b', a: 'a' });
    });

    test('map of an empty object is an empty object', () => {
        let calls = 0;
        const result = objectMap({}, () => {
            calls++;
            return 1;
        });

        expect(result).toStrictEqual({});
        expect(calls).toBe(0);
    });

    test('map transforms values to any shape', () => {
        const result = objectMap({ a: 1, b: 2 }, ({ key, value }) => ({ key, value, doubled: (value as number) * 2 }));
        expect(result).toStrictEqual({
            a: { key: 'a', value: 1, doubled: 2 },
            b: { key: 'b', value: 2, doubled: 4 }
        });
    });
});

describe('Object Map Keys Function', () => {
    test('remap keys to uppercase', () => {
        const result = objectMapKeys({ a: 1, b: 2 }, ({ key }) => key.toUpperCase() as any);
        expect(result).toEqual({ A: 1, B: 2 });
    });

    test('remap keys with prefix', () => {
        const result = objectMapKeys({ a: 1, b: 2 }, ({ key }) => `key_${key}` as any);
        expect(result).toEqual({ key_a: 1, key_b: 2 });
    });

    test('remap keys with null fallback', () => {
        const result = objectMapKeys({ a: 1, b: 2 }, ({ key }) => {
            return key === 'a' ? ('upper_a' as any) : null;
        });
        expect(result).toEqual({ upper_a: 1, b: 2 });
    });

    test('remap keys preserves values', () => {
        const obj = { x: [1, 2], y: { nested: true } };
        const result = objectMapKeys(obj, ({ key }) => `p_${key}` as any);
        expect(result).toEqual({ p_x: [1, 2], p_y: { nested: true } });
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/map.ts:60-75. Keys come from
    // `callback(data) ?? key`, so only null/undefined fall back to the original key, and the
    // original value is always carried over untouched (by reference for objects).
    // ----------------------------------------------------------------------------------------

    test('mapKeys callback receives the exact parameter object on every key', () => {
        const source = { a: 1, b: 2 };
        const snapshots: unknown[] = [];

        const keyMapper = ({ key }: { key: unknown }) => key;
        const result = objectMapKeys(source, (params: any) => {
            snapshots.push({
                keys: Object.keys(params).sort(),
                key: params.key,
                value: params.value,
                index: params.index,
                length: params.length,
                result: params.result,
                isSource: params.object === source,
                // map.ts wraps the user mapper in its own objectEach callback
                isKeyMapper: params.callback === keyMapper
            });
            return `${params.key}_x`;
        });

        expect(snapshots).toStrictEqual([
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                key: 'a',
                value: 1,
                index: 0,
                length: 2,
                result: undefined,
                isSource: true,
                isKeyMapper: false
            },
            {
                keys: ['array', 'callback', 'index', 'key', 'length', 'object', 'result', 'value'],
                key: 'b',
                value: 2,
                index: 1,
                length: 2,
                result: undefined,
                isSource: true,
                isKeyMapper: false
            }
        ]);
        expect(result).toStrictEqual({ a_x: 1, b_x: 2 });
    });

    test('null and undefined mapper results both fall back to the original key', () => {
        // map.ts:71 uses `??`, so only nullish results keep the original key
        expect(objectMapKeys({ a: 1, b: 2 }, ({ key }) => (key === 'a' ? null : undefined) as any)).toStrictEqual({
            a: 1,
            b: 2
        });
    });

    test('empty string and numeric results are used as keys instead of falling back', () => {
        expect(objectMapKeys({ a: 1 }, () => '')).toStrictEqual({ '': 1 });
        expect(objectMapKeys({ a: 1, b: 2 }, ({ index }) => index as any)).toStrictEqual({ 0: 1, 1: 2 });
        // Objects are converted with ToString for the property key
        expect(objectMapKeys({ a: 1 }, () => ({ toString: () => 'objKey' }) as any)).toStrictEqual({ objKey: 1 });
    });

    test('colliding keys keep the last visited value', () => {
        // Iteration order is Object.keys order, so the final write wins
        expect(objectMapKeys({ a: 1, b: 2, c: 3 }, () => 'same')).toStrictEqual({ same: 3 });
        // A rename onto an already-produced key overwrites it, and the two keys differ in case
        expect(objectMapKeys({ a: 1, b: 2 }, ({ key }) => (key === 'b' ? 'a' : 'A'))).toStrictEqual({ A: 1, a: 2 });
    });

    test('values are carried over by reference and unchanged', () => {
        const nested = { deep: true };
        const list = [1];
        const source = { a: nested, b: list };
        const result = objectMapKeys(source, ({ key }) => `k${key}`);

        expect(result).toStrictEqual({ ka: { deep: true }, kb: [1] });
        expect(result.ka).toBe(nested);
        expect(result.kb).toBe(list);
        expect(Object.keys(source)).toStrictEqual(['a', 'b']);
    });

    test('identity mapping produces an equal but new object', () => {
        const source = { a: 1 };
        const result = objectMapKeys(source, ({ key }) => key);

        expect(result).toStrictEqual({ a: 1 });
        expect(result).not.toBe(source);
    });

    test('empty object maps to an empty object without calling the mapper', () => {
        let calls = 0;
        const result = objectMapKeys({}, () => {
            calls++;
            return 'x';
        });

        expect(result).toStrictEqual({});
        expect(calls).toBe(0);
    });

    test('null source throws from the underlying Object.keys call', () => {
        expect(() => objectMapKeys(null as any, () => 'x')).toThrow('Cannot convert undefined or null to object');
    });
});
