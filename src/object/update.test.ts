import { objectUpdate } from '@presource/core';

describe('Object Update', () => {
    test('able to merge objects together', () => {
        const fruits = { apple: 1, banana: 2 };
        const animals = { cat: 3, dog: 4 };

        objectUpdate(fruits, animals);

        expect(fruits).toMatchObject({
            apple: 1,
            banana: 2,
            cat: 3,
            dog: 4
        });
    });

    test('Mutates the target and returns the very same reference', () => {
        const target = { apple: 1, banana: 2 };
        const update = { cat: 3 };

        const returned = objectUpdate(target, update);

        // Identity, not a copy
        expect(returned).toBe(target);
        expect(target).toStrictEqual({ apple: 1, banana: 2, cat: 3 });
        // The update source is left untouched
        expect(update).toStrictEqual({ cat: 3 });
    });

    test('Overwrites existing keys in place and keeps insertion order', () => {
        const target: any = { a: 1, b: 2 };

        objectUpdate(target, { a: 'replaced' });

        // An existing key is overwritten without being moved to the end
        expect(Object.keys(target)).toStrictEqual(['a', 'b']);
        expect(target).toStrictEqual({ a: 'replaced', b: 2 });
    });

    test('Nested objects are replaced wholesale, never merged', () => {
        const nested = { y: 2 };
        const target: any = { a: 1, nested: { x: 1 } };

        const returned = objectUpdate(target, { nested });

        expect(returned.nested).toBe(nested);
        // The previous nested keys are gone because the value was overwritten, not deep merged
        expect(target).toStrictEqual({ a: 1, nested: { y: 2 } });
        expect(target.nested.x).toBeUndefined();
        expect('x' in target.nested).toBe(false);
    });

    test('Undefined values in the update object still overwrite', () => {
        const target: any = { a: 1, nested: { x: 1 } };

        objectUpdate(target, { a: undefined, nested: undefined, fresh: undefined });

        // Object.assign copies every own enumerable key, so undefined is a real write - not a skip
        expect(Object.keys(target)).toStrictEqual(['a', 'nested', 'fresh']);
        expect(target).toStrictEqual({ a: undefined, nested: undefined, fresh: undefined });
    });

    test('An empty update object changes nothing', () => {
        const target: any = { a: 1 };

        const returned = objectUpdate(target, {});

        expect(returned).toBe(target);
        expect(target).toStrictEqual({ a: 1 });
        expect(Object.keys(target)).toStrictEqual(['a']);
    });

    test('Falsy update values are written like any other value', () => {
        const target: any = { a: 1, b: 2, c: 3, d: 4 };

        objectUpdate(target, { a: 0, b: '', c: false, d: null });

        expect(target).toStrictEqual({ a: 0, b: '', c: false, d: null });
    });

    test('Array sources write their index keys', () => {
        const target: any = { a: 1 };

        objectUpdate(target, ['p', 'q'] as any);

        // Object.assign copies own enumerable keys, which for an array are the numeric string keys
        expect(target).toStrictEqual({ a: 1, 0: 'p', 1: 'q' });
        expect(Object.keys(target)).toStrictEqual(['0', '1', 'a']);
    });

    test('A missing update source throws', () => {
        const target: any = { a: 1 };
        let failure: any = null;

        try {
            objectUpdate(target, undefined as any);
        } catch (error: any) {
            failure = { threw: true, name: error.constructor.name };
        }

        expect(failure).toStrictEqual({ threw: true, name: 'TypeError' });
        expect(target).toStrictEqual({ a: 1 });
    });

    test('Updating with a proxy-like getter source copies the resolved value', () => {
        const target: any = {};
        const source: any = {};
        // Enumerable accessor properties are read through Object.keys + property access
        Object.defineProperty(source, 'lazy', {
            enumerable: true,
            configurable: true,
            get: () => 'resolved'
        });

        objectUpdate(target, source);

        expect(target).toStrictEqual({ lazy: 'resolved' });
        expect(Object.getOwnPropertyDescriptor(target, 'lazy')?.get).toBeUndefined();
    });

    test('Own symbol keys are copied, inherited keys stay excluded', () => {
        // M17: objectUpdate is now `Object.assign`, which also copies own enumerable symbol keys
        // (the previous `Object.keys` walk skipped them). Inherited keys - symbol or string - are
        // still never copied, exactly as before.
        const symbol = Symbol('s');
        const target: any = {};

        objectUpdate(target, { [symbol]: 'symbol', visible: true } as any);

        expect(target[symbol]).toBe('symbol');
        expect(target.visible).toBe(true);
        expect(Object.keys(target)).toStrictEqual(['visible']);

        const inheritedSymbol = Symbol('inherited');
        const prototype: any = { inherited: 'no' };
        prototype[inheritedSymbol] = 'no';
        const source: any = Object.create(prototype);
        source.own = 'yes';

        objectUpdate(target, source);

        expect(Object.keys(target)).toStrictEqual(['visible', 'own']);
        expect(target.own).toBe('yes');
        expect('inherited' in target).toBe(false);
        expect(target[inheritedSymbol]).toBeUndefined();
    });

    test('A null update source throws the same TypeError as undefined', () => {
        // M17: `Object.assign` silently ignores a null/undefined source, so update.ts keeps an
        // explicit `Object.keys(update)` guard to preserve the original failure mode.
        const target: any = { a: 1 };

        expect(() => objectUpdate(target, null as any)).toThrow(TypeError);
        expect(() => objectUpdate(target, null as any)).toThrow('Cannot convert undefined or null to object');
        expect(target).toStrictEqual({ a: 1 });
    });

    test('A primitive target no longer throws, and the original reference is returned', () => {
        // M17 difference: the previous per-key assignment hit a strict-mode TypeError on a
        // primitive receiver. `Object.assign` boxes the target internally, so the write is
        // discarded and the caller still receives the untouched primitive reference.
        const target: any = 'abc';

        expect(objectUpdate(target, { a: 1 } as any)).toBe('abc');
        expect(target.a).toBeUndefined();
    });
});
