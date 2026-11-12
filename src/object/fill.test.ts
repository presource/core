import { objectFill } from '@presource/core';

describe('Testing objectFill functionality', () => {
    test('Filling in an object', () => {
        // Let's create a sample for testing
        const sample = { a: 1, b: 2, c: 3, d: 4, e: {}, f: [] };
        // Cannot fill object that key already exists!
        expect(objectFill(sample, { a: 'changed' })).toStrictEqual({ a: 1, b: 2, c: 3, d: 4, e: {}, f: [] });

        // Can Fill if key doesn't exists!
        expect(objectFill(sample, { h: 'changed' })).toStrictEqual({
            a: 1,
            b: 2,
            c: 3,
            d: 4,
            e: {},
            f: [],
            h: 'changed'
        });
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/fill.ts:19-26.
    // The target is mutated in place, a NEW shallow copy is returned, and only keys that fail
    // objectHasKey (own-property check) are copied - values are copied by reference.
    // ----------------------------------------------------------------------------------------

    test('mutates the target in place and returns a different shallow copy', () => {
        const target = { a: 1 };
        const nested = { deep: true };
        const fill = { nested, list: [1, 2] };

        const result = objectFill(target, fill);

        // Both objects end up with the same content...
        expect(result).toStrictEqual({ a: 1, nested: { deep: true }, list: [1, 2] });
        expect(target).toStrictEqual({ a: 1, nested: { deep: true }, list: [1, 2] });
        // ...but the return value is always a fresh `{ ...object }` (fill.ts:25)
        expect(result).not.toBe(target);
        expect(Object.keys(result)).toStrictEqual(['a', 'nested', 'list']);
    });

    test('filled values are copied by reference, not cloned', () => {
        const nested = { deep: true };
        const list = [1, 2];
        const target = {} as Record<string, unknown>;
        const result = objectFill(target, { nested, list });

        expect(result.nested).toBe(nested);
        expect(result.list).toBe(list);
        // The mutation is visible on the original target too
        expect(target.nested).toBe(nested);
        // The shallow copy still shares those references
        expect(result).not.toBe(target);
    });

    test('existing keys keep their own value even when it is undefined', () => {
        // objectHasKey is an own-property check, so a present `undefined` key blocks the fill
        const target = { a: undefined } as { a: unknown };
        const result = objectFill(target, { a: 'default' });

        expect(result).toStrictEqual({ a: undefined });
        expect('a' in result).toBe(true);
        expect(target.a).toBeUndefined();
    });

    test('filling with undefined values still creates the key', () => {
        const target = {} as Record<string, unknown>;
        const result = objectFill(target, { missing: undefined });

        expect(result).toStrictEqual({ missing: undefined });
        expect(Object.keys(result)).toStrictEqual(['missing']);
        expect(target.missing).toBeUndefined();
    });

    test('an empty fill object leaves the content untouched but still copies', () => {
        const target = { a: 1 };
        const result = objectFill(target, {});

        expect(result).toStrictEqual({ a: 1 });
        expect(result).not.toBe(target);
    });

    test('inherited keys on the target are not protected and get shadowed', () => {
        // hasOwnProperty fails for inherited keys, so the fill writes a new OWN key
        const prototype = { inherited: 'proto' };
        const target = Object.create(prototype) as { own: number; inherited: string };
        target.own = 1;

        const result = objectFill(target, { inherited: 'filled' });

        expect(result).toStrictEqual({ own: 1, inherited: 'filled' });
        expect(Object.keys(target)).toStrictEqual(['own', 'inherited']);
        expect(target.inherited).toBe('filled');
        expect(prototype.inherited).toBe('proto');
    });

    test('array targets gain index keys and the return value is a plain object', () => {
        const target = ['a'] as unknown as Record<string, unknown>;
        const result = objectFill(target, { 1: 'b' });

        // The target keeps its array identity, the returned spread copy is a plain object
        expect(target).toStrictEqual(['a', 'b']);
        expect(Array.isArray(target)).toBe(true);
        expect(result).toStrictEqual({ 0: 'a', 1: 'b' });
        expect(Array.isArray(result)).toBe(false);
    });

    test('symbol keys in the fill source are ignored', () => {
        const symbol = Symbol('s');
        const result = objectFill({ a: 1 }, { [symbol]: 'ignored', b: 2 });

        // objectEach walks Object.keys, which skips symbols
        expect(result).toStrictEqual({ a: 1, b: 2 });
        expect((result as Record<symbol, unknown>)[symbol]).toBeUndefined();
    });

    test('function values from the fill source are copied by reference', () => {
        const fn = () => 1;
        const result = objectFill({}, { fn });

        expect(result.fn).toBe(fn);
    });

    test('null or undefined fill source throws from Object.keys', () => {
        expect(() => objectFill({ a: 1 }, null as any)).toThrow('Cannot convert undefined or null to object');
        expect(() => objectFill({ a: 1 }, undefined as any)).toThrow('Cannot convert undefined or null to object');
    });

    test('null or undefined target throws on the hasOwnProperty call', () => {
        expect(() => objectFill(null as any, { a: 1 })).toThrow(TypeError);
        expect(() => objectFill(null as any, { a: 1 })).toThrow("Cannot read properties of null (reading 'hasOwnProperty')");
        expect(() => objectFill(undefined as any, { a: 1 })).toThrow(
            "Cannot read properties of undefined (reading 'hasOwnProperty')"
        );
    });

    test('a non-extensible target throws instead of silently skipping the fill', () => {
        // Strict-mode assignment on a frozen target surfaces the failure
        expect(() => objectFill(Object.freeze({ a: 1 }), { b: 2 })).toThrow(TypeError);
        expect(() => objectFill(Object.freeze({ a: 1 }), { b: 2 })).toThrow('Cannot add property b, object is not extensible');
    });

    test('array fill sources contribute their index keys', () => {
        const result = objectFill({ a: 1 }, ['x', 'y'] as any);

        expect(result).toStrictEqual({ 0: 'x', 1: 'y', a: 1 });
    });
});
