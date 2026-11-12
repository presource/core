import { jsonUpdate } from '@presource/core';

/**
 * Contract source: `src/json/update.ts` (see the pending bug note at update.ts:28).
 *
 * Identity contract (probed, pinned below):
 *  - The call MUTATES `primaryObject` in place and returns that same reference whenever a merge
 *    actually happens (update.ts:30 `let result = primaryObject`).
 *  - Subtrees of `secondaryObject` are ALIASED into the result whenever the primary has no value
 *    at that position (type mismatch branch, update.ts:56-59) — they are not cloned.
 *  - Where both sides already hold an object/array of the same type, the PRIMARY's container is
 *    kept and updated key-by-key / index-by-index, so the result never aliases the secondary.
 */
describe('Basic jsonMerge Test', () => {
    test('Merging and Overwriting Simple Data', () => {
        // Undefined Primary Merging
        expect(jsonUpdate(undefined, 'string')).toBe('string');
        expect(jsonUpdate(undefined, [])).toStrictEqual([]);
        expect(jsonUpdate(undefined, {})).toStrictEqual({});

        // Standard Object Merging
        expect(jsonUpdate({ a: 1 }, { b: 2 })).toStrictEqual({ a: 1, b: 2 });

        // Standard Array Merging
        expect(jsonUpdate([{ a: 1 }], [{ b: 2 }])).toStrictEqual([{ a: 1, b: 2 }]);

        // Simple Overwrite
        expect(jsonUpdate('first', 'second')).toBe('second');
        expect(jsonUpdate({ a: 1 }, { a: 2 })).toStrictEqual({ a: 2 });

        // Simple Check whether exist
        expect(jsonUpdate({ a: 1 }, { b: ['joe', 'mate'] })).toStrictEqual({ a: 1, b: ['joe', 'mate'] });
        expect(jsonUpdate({ a: 1, b: 'ben' }, { b: ['joe', 'mate'] })).toStrictEqual({ a: 1, b: ['joe', 'mate'] });
    });

    test('Advance Merging of Data', () => {
        const originalData = {
            items: [
                { bag: 1, cash: 100, owner: 'jackson' },
                { bag: 2, cash: 50, owner: 'ben' }
            ]
        };

        // Updating Bag 1 with cash 80.
        expect(jsonUpdate(originalData, { items: [{ bag: 1, cash: 80 }] })).toStrictEqual({
            items: [
                { bag: 1, cash: 80, owner: 'jackson' },
                { bag: 2, cash: 50, owner: 'ben' }
            ]
        });
    });

    test('merge array when result is not array', () => {
        const result = jsonUpdate({}, ['a', 'b']);
        expect(result).toStrictEqual(['a', 'b']);
    });

    test('merge object when result is not object', () => {
        const result = jsonUpdate([], { a: 1 });
        expect(result).toStrictEqual({ a: 1 });
    });

    test('primitive replacement', () => {
        expect(jsonUpdate(1, 2)).toBe(2);
        expect(jsonUpdate(true, false)).toBe(false);
    });

    test('same values return secondary', () => {
        expect(jsonUpdate('same', 'same')).toBe('same');
    });

    test('different types return secondary', () => {
        expect(jsonUpdate(1, 'string')).toBe('string');
        expect(jsonUpdate({}, [])).toStrictEqual([]);
        expect(jsonUpdate([], {})).toStrictEqual({});
    });

    test('deep array merge', () => {
        expect(jsonUpdate([{ a: 1 }, { b: 2 }], [{ c: 3 }, { d: 4 }])).toStrictEqual([{ a: 1, c: 3 }, { b: 2, d: 4 }]);
    });

    test('deep object merge', () => {
        expect(jsonUpdate({ a: { x: 1 } }, { a: { y: 2 } })).toStrictEqual({ a: { x: 1, y: 2 } });
    });

    test('merge array when primary has array typeName but is not a real array', () => {
        const fakeArray = { constructor: { name: 'Array' } };
        const result = jsonUpdate(fakeArray, [1, 2, 3]);
        expect(Array.isArray(result)).toBe(true);
        expect(result).toStrictEqual([1, 2, 3]);
    });

    test('merge object when primary has object typeName but is not a real object', () => {
        const fakeObj = { constructor: { name: 'Object' } };
        const result = jsonUpdate(fakeObj, { a: 1, b: 2 });
        expect(result).toStrictEqual({ a: 1, b: 2 });
    });
});

describe('jsonUpdate mutation and identity contract', () => {
    // update.ts:30 keeps the primary reference, so the return value IS the primary object.
    test('should return the primary reference and mutate it for an object merge', () => {
        const primary: Record<string, any> = { a: 1 };
        const secondary = { b: 2 };

        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(primary).toStrictEqual({ a: 1, b: 2 });
    });

    // A secondary object assigned into a key the primary does not have is aliased, not copied.
    test('should alias secondary subtrees into keys the primary is missing', () => {
        const primary: Record<string, any> = { a: 1 };
        const deep = { deep: 1 };
        const secondary = { b: deep };

        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(primary.b).toBe(deep);
        expect(result.b).toBe(secondary.b);
    });

    // The same secondary object used for two NEW keys ends up shared by reference in the result.
    test('should share one secondary subtree between two newly added keys', () => {
        const shared = { v: 1 };
        const result = jsonUpdate({}, { a: shared, b: shared });

        expect(result).toStrictEqual({ a: { v: 1 }, b: { v: 1 } });
        expect(result.a).toBe(shared);
        expect(result.b).toBe(shared);
        expect(result.a).toBe(result.b);
    });

    // Opposite case: when the primary already owns an object at that key, the primary's object is
    // updated in place and never becomes the secondary's object.
    test('should keep and mutate the primary subtree when both sides hold an object', () => {
        const inner: Record<string, any> = { x: 1 };
        const primary = { a: inner };
        const secondary = { a: { y: 2 } };

        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(result.a).toBe(inner);
        expect(inner).toStrictEqual({ x: 1, y: 2 });
        expect(result.a).not.toBe(secondary.a);
        // The secondary object is left untouched by the merge.
        expect(secondary.a).toStrictEqual({ y: 2 });
    });

    // A primitive secondary value replaces whatever object the primary held, in place.
    test('should overwrite a primary object with a secondary primitive in place', () => {
        const primary: Record<string, any> = { a: { b: 1 } };
        const result = jsonUpdate(primary, { a: 'str' });

        expect(result).toBe(primary);
        expect(result).toStrictEqual({ a: 'str' });
        expect(primary.a).toBe('str');
    });

    test('should return the primary itself unchanged when both references are identical', () => {
        const obj = { a: 1 };
        expect(jsonUpdate(obj, obj)).toBe(obj);

        const arr = [1, 2];
        expect(jsonUpdate(arr, arr)).toBe(arr);
        expect(arr).toStrictEqual([1, 2]);
    });

    test('should ignore secondary keys that are explicitly undefined but still create them', () => {
        const primary: Record<string, any> = { a: 1 };
        const result = jsonUpdate(primary, { b: undefined });

        expect(result).toBe(primary);
        expect(result).toStrictEqual({ a: 1, b: undefined });
        expect(Object.keys(result)).toStrictEqual(['a', 'b']);
        expect(result.b).toBeUndefined();
    });
});

describe('jsonUpdate array merge semantics', () => {
    // Arrays merge index-by-index; the primary's extra trailing slots survive untouched.
    test('should keep trailing primary elements when the secondary array is shorter', () => {
        const primary = [1, 2, 3];
        const result = jsonUpdate(primary, ['a']);

        expect(result).toBe(primary);
        expect(result).toStrictEqual(['a', 2, 3]);
    });

    // Secondary entries past the primary length are appended, and object entries are aliased.
    test('should append secondary entries past the primary length', () => {
        const primary = [1];
        const appended = { z: 1 };
        const result = jsonUpdate(primary, [9, appended]);

        expect(result).toBe(primary);
        expect(result).toStrictEqual([9, { z: 1 }]);
        expect(result[1]).toBe(appended);
    });

    // Index merging walks the secondary, so a hole in the primary is filled by position 0.
    test('should fill a primary hole at index 0', () => {
        const primary = [, 1];
        const result = jsonUpdate(primary, [2]);

        expect(result).toBe(primary);
        expect(result).toStrictEqual([2, 1]);
        expect(0 in result).toBe(true);
    });

    // Nested object elements merge into the PRIMARY element, never onto the secondary element.
    test('should merge nested element objects into the primary element reference', () => {
        const primary = [{ a: 1 }, { b: 2 }];
        const secondary = [{ c: 3 }];
        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(result).toStrictEqual([{ a: 1, c: 3 }, { b: 2 }]);
        expect(result[0]).toBe(primary[0]);
        expect(result[0]).not.toBe(secondary[0]);
        expect(result[1]).toBe(primary[1]);
    });

    // Arrays inside object values reuse the primary's array reference and its nested elements.
    test('should reuse the primary list and element references when merging nested arrays of objects', () => {
        const primary = { list: [{ id: 1, tags: ['a'] }, { id: 2 }] };
        const secondary = { list: [{ name: 'x', tags: ['b', 'c'] }] };

        const result: any = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(result).toStrictEqual({
            list: [{ id: 1, tags: ['b', 'c'], name: 'x' }, { id: 2 }]
        });
        expect(result.list).toBe(primary.list);
        expect(result.list[0]).not.toBe(secondary.list[0]);
        // The primary's own `tags` array instance is retained, its slots overwritten.
        expect(primary.list[0].tags).toStrictEqual(['b', 'c']);
    });

    // Array-in-array merge keeps the primary inner array for untouched indexes.
    test('should keep untouched inner arrays from the primary', () => {
        const primary = [[1], [2]];
        const secondary = [[3]];
        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(result).toStrictEqual([[3], [2]]);
        expect(result[0]).not.toBe(secondary[0]);
        expect(result[1]).toBe(primary[1]);
    });
});

describe('jsonUpdate type mismatch and non-merge paths', () => {
    // typeName('') for null/undefined never matches, so the secondary wins outright.
    test('should return null secondary over an object primary', () => {
        const primary = { a: 1 };
        const result = jsonUpdate(primary, null);

        expect(result).toBeNull();
        expect(result).not.toBe(primary);
        expect(primary).toStrictEqual({ a: 1 });
    });

    test('should return undefined secondary over an object primary', () => {
        const primary = { a: 1 };
        expect(jsonUpdate(primary, undefined)).toBeUndefined();
        expect(primary).toStrictEqual({ a: 1 });
    });

    test('should return null for null and null', () => {
        expect(jsonUpdate(null, null)).toBeNull();
    });

    // Different built-in types: primary is Date-typed value, secondary plain object -> secondary wins by reference.
    test('should let a plain object secondary replace a Date primary value', () => {
        const primary = { x: new Date(0) };
        const secondary = { x: { z: 1 } };
        const result: any = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(result.x).toBe(secondary.x);
        expect(result).toStrictEqual({ x: { z: 1 } });
    });

    // A secondary Date object has typeName 'date', so it replaces a plain object value by reference.
    test('should alias a Date secondary value into an existing object key', () => {
        const date = new Date(0);
        const result: any = jsonUpdate({ x: 1 }, { x: date });

        expect(result.x).toBe(date);
        expect(result.x instanceof Date).toBe(true);
    });

    // Functions are never recursed into: typeName 'function' vs 'number' -> secondary reference.
    test('should store a function secondary by reference', () => {
        const fn = () => 1;
        const result: any = jsonUpdate({ f: 1 }, { f: fn });

        expect(result.f).toBe(fn);
    });

    // typeName of an array primary ('array') vs object secondary ('object') -> secondary wins as-is.
    test('should return the secondary object when the primary is an empty array', () => {
        const secondary = { 0: 'z' };
        const result = jsonUpdate([], secondary);

        expect(result).toBe(secondary);
        expect(Array.isArray(result)).toBe(false);
        expect(result).toStrictEqual({ 0: 'z' });
    });

    // `Object.create(null)` has no constructor, so typeName is '' and no merge branch runs.
    test('should replace a prototype-less primary with a plain object secondary', () => {
        const primary: Record<string, any> = Object.create(null);
        primary.a = 1;
        const secondary = { b: 2 };

        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(secondary);
        expect(result).toStrictEqual({ b: 2 });
        expect(primary.a).toBe(1);
    });

    test('should treat cross-type primitives as full replacement', () => {
        expect(jsonUpdate(true, 0)).toBe(0);
        expect(jsonUpdate(0, false)).toBe(false);
        expect(jsonUpdate('a', 'b')).toBe('b');
        expect(jsonUpdate('str', { a: 1 })).toStrictEqual({ a: 1 });
        expect(jsonUpdate(1, [2])).toStrictEqual([2]);
    });

    // Real containers are replaced by the secondary reference when the type names differ.
    test('should return the secondary reference for a container type mismatch', () => {
        const array = ['a', 'b'];
        expect(jsonUpdate({}, array)).toBe(array);

        const object = { a: 1 };
        expect(jsonUpdate([], object)).toBe(object);
    });
});

/**
 * Pins for the predicate-based dispatch (update.ts:56-84): the merge decision now uses
 * `Array.isArray` / `isObject` instead of `typeName` equality + `typeSwitch`, so the only
 * observable change is for "imitation containers" whose own `constructor.name` mimics a
 * built-in. Those used to satisfy typeName equality and be rebuilt into a fresh `[]`/`{}`;
 * they are now plain non-containers, so the secondary reference wins (same value, no copy).
 */
describe('jsonUpdate predicate dispatch', () => {
    test('should replace an imitation array primary with the secondary array reference', () => {
        const fakeArray = { constructor: { name: 'Array' } };
        const secondary = [1, 2, 3];

        const result = jsonUpdate(fakeArray, secondary);

        expect(result).toBe(secondary);
        expect(result).toStrictEqual([1, 2, 3]);
        // The imitation primary is left untouched — it is no longer merged into.
        // (`toEqual`, not `toStrictEqual`: vitest's strict check compares `a.constructor`,
        // which is the faked own property here and therefore never identical.)
        expect(fakeArray).toEqual({ constructor: { name: 'Array' } });
    });

    test('should replace an imitation object primary with the secondary object reference', () => {
        const fakeObject = { constructor: { name: 'Object' } };
        const secondary = { a: 1, b: 2 };

        const result = jsonUpdate(fakeObject, secondary);

        expect(result).toBe(secondary);
        expect(fakeObject).toEqual({ constructor: { name: 'Object' } });
    });

    // Genuine delta, not preserved behaviour: under the old `typeName(a) === typeName(b) &&
    // a !== b` test the `0`/`-0` pair failed `a !== b`, so it took the `else` branch — which
    // ALWAYS returned the SECONDARY. HEAD therefore gave `jsonUpdate(0, -0) === -0` and
    // `jsonUpdate(-0, 0) === 0`; the identity guard now keeps the PRIMARY instead. NaN never
    // compares equal, so it still falls through to the secondary (that half is unchanged).
    test('should keep the primary for ===-equal primitives and take the secondary for NaN', () => {
        expect(Object.is(jsonUpdate(0, -0), 0)).toBe(true);
        expect(jsonUpdate(NaN, NaN)).toBe(NaN);
    });

    // Sparse secondaries keep hole-skipping: `forEach` never visits an empty slot, so the
    // primary element at that index is preserved rather than merged with `undefined`.
    test('should skip secondary array holes when merging by index', () => {
        const primary = [{ a: 1 }, { b: 2 }];
        const secondary = [, { c: 3 }];

        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(result).toStrictEqual([{ a: 1 }, { b: 2, c: 3 }]);
        expect(1 in result).toBe(true);
    });

    // Inherited (non-own) secondary keys stay invisible, as `objectEach` enumerates own keys.
    test('should ignore inherited properties of the secondary object', () => {
        const proto = { inherited: 'ignored' };
        const secondary = Object.create(proto) as Record<string, any>;
        secondary.own = 1;
        const primary: Record<string, any> = { kept: true };

        const result = jsonUpdate(primary, secondary);

        expect(result).toBe(primary);
        expect(primary).toStrictEqual({ kept: true, own: 1 });
    });
});
