import { objectHasKey } from '@presource/core';

describe('Object Has', () => {
    const example = { a: 'apple', b: 'banana', c: 'cat', d: 'dog' };

    test('Object has key', () => {
        expect(objectHasKey(example, 'a')).toBeTruthy();
        expect(objectHasKey(example, 'e')).toBeFalsy();
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/has.ts:15 - a bare own-property
    // `object.hasOwnProperty(key)` guard, so the prototype chain is excluded and non-object
    // receivers surface a TypeError rather than a boolean.
    // ----------------------------------------------------------------------------------------

    test('own properties are true and prototype-chain properties are false', () => {
        const prototype = { inherited: 1 };
        const instance = Object.create(prototype) as { own: number } & { inherited: number };
        instance.own = 2;

        expect(objectHasKey(instance, 'own')).toBe(true);
        expect(objectHasKey(instance, 'inherited')).toBe(false);
        // Built-ins reachable through the chain are not own keys
        expect(objectHasKey(instance, 'toString')).toBe(false);
        expect(objectHasKey({}, 'hasOwnProperty')).toBe(false);
        expect(objectHasKey(instance, 'missing')).toBe(false);
    });

    test('a key holding undefined or null still counts as present', () => {
        expect(objectHasKey({ a: undefined }, 'a')).toBe(true);
        expect(objectHasKey({ a: null }, 'a')).toBe(true);
        expect(objectHasKey({}, 'a')).toBe(false);
    });

    test('arrays answer for index keys and their own length property', () => {
        const list = ['x'];

        expect(objectHasKey(list, 0)).toBe(true);
        expect(objectHasKey(list, '0')).toBe(true);
        expect(objectHasKey(list, 1)).toBe(false);
        expect(objectHasKey(list, 'length')).toBe(true);
        // Array methods live on Array.prototype, so they are not own keys
        expect(objectHasKey(list, 'push')).toBe(false);
    });

    test('symbol and empty-string keys are supported', () => {
        const symbol = Symbol('s');
        expect(objectHasKey({ [symbol]: 1 }, symbol)).toBe(true);
        expect(objectHasKey({ [symbol]: 1 }, 'a')).toBe(false);
        expect(objectHasKey({ '': 1 }, '')).toBe(true);
    });

    test('numeric keys are matched after property-key coercion', () => {
        expect(objectHasKey({ 1: 'a' }, 1)).toBe(true);
        expect(objectHasKey({ 1: 'a' }, '1')).toBe(true);
        expect(objectHasKey({ 1: 'a' }, '01')).toBe(false);
    });

    test('accessor properties and primitive boxed receivers count as own keys', () => {
        expect(objectHasKey({ get a() { return 1; } }, 'a')).toBe(true);

        const fn = () => 1;
        (fn as { tag?: string }).tag = 'fn';
        expect(objectHasKey(fn, 'tag')).toBe(true);
        // Function instances own `name`/`length`
        expect(objectHasKey(fn, 'name')).toBe(true);

        // Primitive receivers are boxed, which owns `length`
        expect(objectHasKey('abc', 'length')).toBe(true);
    });

    test('null and undefined receivers throw', () => {
        expect(() => objectHasKey(null as any, 'a')).toThrow(TypeError);
        expect(() => objectHasKey(null as any, 'a')).toThrow("Cannot read properties of null (reading 'hasOwnProperty')");
        expect(() => objectHasKey(undefined as any, 'a')).toThrow(
            "Cannot read properties of undefined (reading 'hasOwnProperty')"
        );
    });

    test('prototype-less objects throw because hasOwnProperty is looked up on the receiver', () => {
        // has.ts:15 calls `object.hasOwnProperty` instead of Object.prototype.hasOwnProperty.call,
        // so a null-prototype object has no method to invoke
        const bare = Object.create(null) as Record<string, number>;
        bare.z = 1;

        expect(() => objectHasKey(bare, 'z')).toThrow(TypeError);
        expect(() => objectHasKey(bare, 'z')).toThrow('hasOwnProperty is not a function');
    });
});
