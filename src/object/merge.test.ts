import { objectMerge } from '@presource/core';

describe('objectMerge', () => {
    it('should merging with single level objects', () => {
        const object1 = { a: 1, b: 2, c: 3 };
        const object2 = { d: 4, e: 5, f: 6 };
        const object3 = { a: 'a', e: 'e', g: 'g' };
        // Concating Items together
        expect(objectMerge(object1, object2)).toStrictEqual({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
        // Object 1 and 2 should remain unchanged
        expect(object1).toStrictEqual({ a: 1, b: 2, c: 3 });
        expect(object2).toStrictEqual({ d: 4, e: 5, f: 6 });

        // Overwriting
        expect(objectMerge(object1, object2, object3)).toStrictEqual({
            a: 'a',
            b: 2,
            c: 3,
            d: 4,
            e: 'e',
            f: 6,
            g: 'g'
        });
        // Object 1, 2 and 3 should still be the same
        expect(object1).toStrictEqual({ a: 1, b: 2, c: 3 });
        expect(object2).toStrictEqual({ d: 4, e: 5, f: 6 });
        expect(object3).toStrictEqual({ a: 'a', e: 'e', g: 'g' });
    });

    it('should merging with multiple nested objects', () => {
        const fruitList1 = { fruits: { a: { apple: 1 }, b: { banana: 2 } } };
        const fruitList2 = { fruits: { o: { orange: 1 }, p: { pineapple: 2 } } };
        const fruitList3 = { fruits: { a: { appricot: 1 }, p: { pears: 2 } } };

        expect(objectMerge(fruitList1, fruitList2)).toStrictEqual({
            fruits: {
                a: { apple: 1 },
                b: { banana: 2 },
                o: { orange: 1 },
                p: { pineapple: 2 }
            }
        });

        expect(objectMerge(fruitList2, fruitList3)).toStrictEqual({
            fruits: {
                a: { appricot: 1 },
                p: { pears: 2, pineapple: 2 },
                o: { orange: 1 }
            }
        });

        expect(objectMerge(fruitList1, fruitList2, fruitList3)).toStrictEqual({
            fruits: {
                a: { apple: 1, appricot: 1 },
                b: { banana: 2 },
                o: { orange: 1 },
                p: { pineapple: 2, pears: 2 }
            }
        });
    });

    it('should merge none object such as functions', () => {
        const callbacks = {
            apple: () => 'apple',
            banana: () => 'banana',
            fruits: {
                total: () => 5
            }
        };
        const listing = {
            fruits: {
                a: 'apple',
                b: 'banana'
            }
        };

        expect(objectMerge(callbacks, listing)).toStrictEqual({
            ...callbacks,
            fruits: {
                ...listing.fruits,
                ...callbacks.fruits
            }
        });
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/merge.ts:25-52. Recursion happens only when the
    // incoming value is a plain object (merge.ts:35 `isObject`) AND the accumulated value
    // already is a plain object (merge.ts:41); everything else overwrites wholesale.
    // ----------------------------------------------------------------------------------------

    it('should merge zero and one arguments', () => {
        expect(objectMerge()).toStrictEqual({});

        const single = { a: 1 };
        const result = objectMerge(single);

        expect(result).toStrictEqual({ a: 1 });
        // A fresh accumulator is always returned, even for a single input
        expect(result).not.toBe(single);
    });

    it('should merge three or more arguments left to right with the last writer winning', () => {
        expect(objectMerge({ a: 1 }, { b: 2 }, { a: 3, c: 4 })).toStrictEqual({ a: 3, b: 2, c: 4 });
        expect(objectMerge({ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 })).toStrictEqual({ a: 5 });
        expect(objectMerge({ a: 1 }, {}, { b: 2 }, {}, { c: 3 })).toStrictEqual({ a: 1, b: 2, c: 3 });
    });

    it('should replace array values wholesale instead of merging by index', () => {
        const first = { list: [1, 2], nested: { arr: [{ a: 1 }] } };
        const second = { list: [3], nested: { arr: [{ b: 2 }] } };
        const result = objectMerge(first, second);

        // Arrays are not the "object" bucket, so both the top-level and nested arrays overwrite
        expect(result).toStrictEqual({ list: [3], nested: { arr: [{ b: 2 }] } });
        expect(result.list).toBe(second.list);
        expect(first.list).toStrictEqual([1, 2]);
        expect(second.list).toStrictEqual([3]);
    });

    it('should overwrite with functions and keep the incoming reference', () => {
        const firstFn = () => 'a';
        const secondFn = () => 'b';
        const result = objectMerge(
            { fn: firstFn, obj: { a: 1 } },
            { fn: secondFn, obj: { b: 2 } }
        );

        expect(result.fn).toBe(secondFn);
        expect(result.fn()).toBe('b');
        // The sibling plain object still merges recursively
        expect(result.obj).toStrictEqual({ a: 1, b: 2 });
        expect(Object.keys(result)).toStrictEqual(['fn', 'obj']);
    });

    it('should let null and undefined overwrite a plain object', () => {
        // null/undefined fail the `isObject` test at merge.ts:35, so the overwrite branch (:44) runs
        expect(objectMerge({ a: { b: 1 } }, { a: null })).toStrictEqual({ a: null });
        expect(objectMerge({ a: { b: 1 } }, { a: undefined })).toStrictEqual({ a: undefined });
        // Keys written with undefined stay present in the result
        expect('a' in objectMerge({ a: 1 }, { a: undefined })).toBe(true);
    });

    it('should let a plain object overwrite a null placeholder', () => {
        // The accumulated value is null, so the `isObject(currentValue)` guard at merge.ts:41
        // hands the incoming value straight through (aliased, not cloned)
        const incoming = { b: 1 };
        const result = objectMerge({ a: null }, { a: incoming });

        expect(result).toStrictEqual({ a: { b: 1 } });
        expect(result.a).toBe(incoming);
    });

    it('should treat class instances as plain values and never recurse into them', () => {
        class Model {
            x = 1;
        }
        const instance = new Model();

        // isObject() compares the constructor to Object, so a class instance overwrites an object
        const forward = objectMerge({ v: { plain: 1 } }, { v: instance as any });
        expect(forward.v).toBe(instance);
        expect(forward.v instanceof Model).toBe(true);

        // ...and is itself overwritten by a plain object
        const backward = objectMerge({ v: instance as any }, { v: { extra: 2 } });
        expect(backward.v).toStrictEqual({ extra: 2 });
        expect(backward.v).not.toBe(instance);
    });

    it('should build brand new objects on every merged level and never touch the inputs', () => {
        const first = { deep: { a: 1, nested: { x: 1 } } };
        const second = { deep: { b: 2, nested: { y: 2 } } };
        const result = objectMerge(first, second);

        expect(result).toStrictEqual({ deep: { a: 1, nested: { x: 1, y: 2 }, b: 2 } });
        // Both merged levels are freshly created
        expect(result.deep).not.toBe(first.deep);
        expect(result.deep).not.toBe(second.deep);
        expect(result.deep.nested).not.toBe(first.deep.nested);
        expect(result.deep.nested).not.toBe(second.deep.nested);

        // Mutating the merged tree does not leak into either input
        result.deep.nested.added = true;
        expect(first).toStrictEqual({ deep: { a: 1, nested: { x: 1 } } });
        expect(second).toStrictEqual({ deep: { b: 2, nested: { y: 2 } } });
    });

    it('should carry non-conflicting nested objects by reference', () => {
        const only = { only: 'me' };
        const result = objectMerge({}, { keep: only });

        // No recursion happens when the accumulator has no object to merge with
        expect(result.keep).toBe(only);
    });

    it('should keep first-seen key ordering with later values overwriting in place', () => {
        const result = objectMerge({ z: 1, a: 2, 2: 3 }, { m: 4, z: 5 });

        // Integer-like keys sort first, then insertion order; `z` keeps its original slot
        expect(Object.keys(result)).toStrictEqual(['2', 'z', 'a', 'm']);
        expect(result).toStrictEqual({ 2: 3, z: 5, a: 2, m: 4 });
    });

    it('should merge stringly-typed keys as separate properties', () => {
        expect(objectMerge({ 1: 'a' }, { '01': 'b' })).toStrictEqual({ 1: 'a', '01': 'b' });
    });

    it('should accept arrays as top-level arguments and merge their index keys', () => {
        const result = objectMerge({ a: 1 }, ['x', 'y'] as any);

        expect(result).toStrictEqual({ 0: 'x', 1: 'y', a: 1 });
    });

    it('should skip symbol keys and inherited properties of the arguments', () => {
        const symbol = Symbol('s');
        expect(Object.keys(objectMerge({ [symbol]: 1, a: 1 }, { b: 2 }))).toStrictEqual(['a', 'b']);

        const child = Object.create({ inherited: 1 }) as { own: number } & { inherited: number };
        child.own = 2;
        expect(objectMerge(child, {})).toStrictEqual({ own: 2 });
    });

    it('should merge deeply nested structures across three or more arguments', () => {
        const result = objectMerge(
            { a: { b: { c: 1, d: { e: 1 } } } },
            { a: { b: { d: { f: 2 } } } },
            { a: { b: { c: 3 } } }
        );

        expect(result).toStrictEqual({ a: { b: { c: 3, d: { e: 1, f: 2 } } } });
    });

    it('should be stable when the same object is merged with itself', () => {
        const source = { a: { b: 1 } };
        const result = objectMerge(source, source);

        expect(result).toStrictEqual({ a: { b: 1 } });
        expect(result.a).not.toBe(source.a);
    });

    it('should throw when an argument is null or undefined', () => {
        // objectEach walks Object.keys on every argument (merge.ts:31)
        expect(() => objectMerge({ a: 1 }, null as any)).toThrow(TypeError);
        expect(() => objectMerge({ a: 1 }, null as any)).toThrow('Cannot convert undefined or null to object');
        expect(() => objectMerge({ a: 1 }, undefined as any)).toThrow('Cannot convert undefined or null to object');
    });

    it('should blow the stack on a two-sided cycle instead of tracking visited objects', () => {
        // G5: objectMerge has no seen-set. `a.self = a` / `b.self = b` means every level has a
        // plain object on both sides, so the recursion at merge.ts:41 never bottoms out and the
        // engine raises RangeError (Maximum call stack size exceeded).
        const first: any = {};
        first.self = first;
        const second: any = {};
        second.self = second;

        expect(() => objectMerge(first, second)).toThrow(RangeError);
        // Nothing is mutated on the way down: the inputs keep their shape after the abort
        expect(first.self).toBe(first);
        expect(second.self).toBe(second);
    });

    it('should alias a one-sided cycle by reference instead of recursing into it', () => {
        // G5: the cycle only merges when the accumulator already holds a plain object. With the
        // key present on one side only, merge.ts:41 hands the cyclic object through untouched,
        // so no RangeError happens and the result aliases the original.
        const cyclic: any = {};
        cyclic.self = cyclic;

        const result = objectMerge(cyclic, { other: 1 });

        expect(result.self).toBe(cyclic);
        expect(result.self.self).toBe(cyclic);
        expect(result.other).toBe(1);
        expect(Object.keys(result)).toStrictEqual(['self', 'other']);

        // The first colliding level still merges (a fresh object is built), and one recursion
        // step in, the accumulator side is the cycle while the incoming side is a plain object,
        // so the cycle is aliased one level down rather than recursed forever.
        const collided = objectMerge(cyclic, { self: { added: 2 } });

        expect(collided.self).not.toBe(cyclic);
        expect(collided.self.added).toBe(2);
        expect(collided.self.self).toBe(cyclic);
    });
});
