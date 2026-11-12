import { dataClone } from '@presource/core';

/**
 * Contract source: `src/data/clone.ts`.
 *
 * `dataClone` dispatches on `typeSwitch` (clone.ts:42-56), so ONLY values whose typeName is
 * exactly `array` or `object` are rebuilt. Everything else — Date, Map, Set, WeakMap, RegExp,
 * class instances, boxed primitives, functions, symbols, bigints and prototype-less objects —
 * falls into the `default` branch and is returned BY REFERENCE (clone.ts:55).
 */
describe('Data cloning', () => {
    test('Cloning primitive datas', () => {
        expect(dataClone(1)).toBe(1);
        expect(dataClone('apple')).toBe('apple');
    });

    test('Cloning data arrays', () => {
        // Basic Array Check
        expect(dataClone([])).toStrictEqual([]);
        expect(dataClone([1, 2, 3])).toStrictEqual([1, 2, 3]);
    });

    test('Cloning data objects', () => {
        expect(dataClone({})).toMatchObject({});
        expect(dataClone({ a: 'apple' })).toMatchObject({ a: 'apple' });
    });
});

describe('dataClone primitives and nullish values', () => {
    test('should return undefined and null unchanged', () => {
        expect(dataClone(undefined)).toBeUndefined();
        expect(dataClone(null)).toBeNull();
    });

    // Non-finite numbers are primitives: they are returned as-is, not coerced to 0.
    test('should return every primitive form unchanged', () => {
        expect(dataClone(0)).toBe(0);
        expect(dataClone('')).toBe('');
        expect(dataClone(false)).toBe(false);
        expect(dataClone(true)).toBe(true);
        expect(dataClone(-1.5)).toBe(-1.5);
        expect(dataClone(Infinity)).toBe(Infinity);
        expect(dataClone(-Infinity)).toBe(-Infinity);
        expect(dataClone(NaN)).toBe(NaN);
    });

    // BigInt and Symbol have no `object`/`array` typeName, so the default branch returns them.
    test('should return bigint and symbol primitives unchanged', () => {
        const symbol = Symbol('tag');
        expect(dataClone(10n)).toBe(10n);
        expect(dataClone(symbol)).toBe(symbol);
        expect(dataClone({ b: 10n, s: symbol })).toStrictEqual({ b: 10n, s: symbol });
        expect(dataClone({ s: symbol }).s).toBe(symbol);
    });

    // Boxed primitives keep their constructor name capitalization ("String"/"Number"/"Boolean"),
    // which never matches the `string`/`number`/`boolean` case keys, so identity is preserved.
    test('should return boxed primitives by reference', () => {
        const boxedString = new String('x');
        const boxedNumber = new Number(7);
        const boxedBoolean = new Boolean(true);

        expect(dataClone(boxedString)).toBe(boxedString);
        expect(dataClone(boxedNumber)).toBe(boxedNumber);
        expect(dataClone(boxedBoolean)).toBe(boxedBoolean);
        expect(dataClone({ v: boxedNumber }).v).toBe(boxedNumber);
    });

    // Functions are not plain objects: they are shared, not copied.
    test('should return functions by reference', () => {
        function declaration() {
            return 1;
        }
        const arrow = () => 2;
        const method = { fn: declaration, arrow };
        const cloned = dataClone(method);

        expect(cloned.fn).toBe(declaration);
        expect(cloned.arrow).toBe(arrow);
        // The surrounding container is still a fresh object.
        expect(cloned).not.toBe(method);
    });
});

describe('dataClone reference-preserving built-in objects', () => {
    test('should return a Date by reference instead of cloning it', () => {
        const date = new Date('2020-01-02T03:04:05.006Z');

        expect(dataClone(date)).toBe(date);

        const wrapped = { d: date };
        const cloned = dataClone(wrapped);
        // The wrapper object is rebuilt, the Date inside it is the same instance.
        expect(cloned.d).toBe(date);
        expect(cloned.d).toBe(wrapped.d);
        expect(cloned).not.toBe(wrapped);
    });

    // Mutating the "clone" of a Map is visible in the source: proof of shared reference.
    test('should return a Map by reference and leak mutations back to the source', () => {
        const source = { m: new Map<string, any>([['k', { n: 1 }]]) };
        const cloned = dataClone(source);

        expect(cloned.m).toBe(source.m);
        cloned.m.set('k2', 2);
        expect(source.m.size).toBe(2);
        // The map values are shared too — no per-entry copying happens.
        expect(source.m.get('k')).toBe(cloned.m.get('k'));
    });

    test('should return Set and WeakMap by reference', () => {
        const set = new Set([1, 2]);
        const weak = new WeakMap();
        const cloned = dataClone({ set, weak });

        expect(cloned.set).toBe(set);
        expect(cloned.weak).toBe(weak);
        expect(dataClone(set)).toBe(set);
    });

    test('should return a RegExp by reference', () => {
        const re = /ab+c/gi;
        expect(dataClone(re)).toBe(re);
        expect(dataClone({ re }).re).toBe(re);
    });

    // Class instances (nested and inside arrays) keep constructor identity and are never rebuilt.
    test('should return class instances by reference in objects and arrays', () => {
        class Widget {
            x = 1;
        }
        const widget = new Widget();
        const nested = { w: widget };
        const list = [widget];

        expect(dataClone(nested).w).toBe(widget);
        expect(dataClone(list)[0]).toBe(widget);
        expect(dataClone(widget)).toBe(widget);
    });

    // `Object.create(null)` has no constructor: typeName() is '' and the value is treated as the
    // "null" branch of typeSwitch, so it is returned as-is even when nested.
    test('should return prototype-less objects by reference and not recurse into them', () => {
        const nullProto = Object.create(null);
        nullProto.a = 1;

        expect(dataClone(nullProto)).toBe(nullProto);

        const wrapped = { o: nullProto };
        const cloned = dataClone(wrapped);
        expect(cloned.o).toBe(nullProto);
        expect(cloned).not.toBe(wrapped);
    });
});

describe('dataClone container rebuilding', () => {
    test('should produce a new array instance with independently cloned members', () => {
        const source = [1, { a: 2 }, [3]];
        const cloned = dataClone(source);

        expect(cloned).not.toBe(source);
        expect(cloned).toStrictEqual([1, { a: 2 }, [3]]);
        expect(cloned[1]).not.toBe(source[1]);
        expect(cloned[2]).not.toBe(source[2]);
    });

    test('should produce a new object instance with independently cloned members', () => {
        const source = { a: { b: { c: 1 } } };
        const cloned = dataClone(source);

        expect(cloned).not.toBe(source);
        expect(cloned.a).not.toBe(source.a);
        expect(cloned.a.b).not.toBe(source.a.b);
        expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
    });

    // Mutating a deep clone in several places must not touch the source tree.
    test('should be fully independent for array-in-object-in-array after nested mutations', () => {
        const source: any = { a: [1, { b: [2, { c: 3 }] }] };
        const cloned: any = dataClone(source);

        cloned.a[1].b[1].c = 99;
        cloned.a.push('appended');
        cloned.a[1].b.push({ c: 0 });
        cloned.a[1].b[2].c = 7;

        expect(source).toStrictEqual({ a: [1, { b: [2, { c: 3 }] }] });
        expect(cloned).toStrictEqual({ a: [1, { b: [2, { c: 99 }, { c: 7 }] }, 'appended'] });
    });

    test('should keep shared references duplicated instead of identity-preserving', () => {
        const leaf = { l: 1 };
        const source = { a: leaf, b: leaf };
        const cloned = dataClone(source);

        expect(cloned.a).not.toBe(leaf);
        expect(cloned.b).not.toBe(leaf);
        // A cache-aware clone would make these equal; this implementation copies them separately.
        expect(cloned.a).not.toBe(cloned.b);
        expect(cloned).toStrictEqual({ a: { l: 1 }, b: { l: 1 } });
    });

    test('should preserve array holes (sparse arrays) without compacting them', () => {
        const source = [, 1, , 2];
        const cloned = dataClone(source);

        expect(cloned).not.toBe(source);
        expect(cloned.length).toBe(4);
        expect(0 in cloned).toBe(false);
        expect(1 in cloned).toBe(true);
        expect(2 in cloned).toBe(false);
        expect(3 in cloned).toBe(true);
        expect(JSON.stringify(cloned)).toBe('[null,1,null,2]');
    });

    // Only own enumerable STRING keys are copied by objectEach, so symbol keys disappear.
    test('should drop symbol-keyed properties while keeping string keys', () => {
        const key = Symbol('k');
        const source = { [key]: 1, a: 2 };
        const cloned = dataClone(source);

        expect(key in cloned).toBe(false);
        expect(Object.keys(cloned)).toStrictEqual(['a']);
        expect(cloned.a).toBe(2);
    });

    // Key insertion order follows JS own-key order: integer-like keys come first.
    test('should rebuild keys in canonical own-key order', () => {
        const source = { b: 1, a: 2, 0: 3 };
        const cloned = dataClone(source);

        expect(Object.keys(cloned)).toStrictEqual(['0', 'b', 'a']);
        expect(cloned).toStrictEqual({ 0: 3, b: 1, a: 2 });
    });

    test('should deep clone empty containers into fresh instances', () => {
        const source = { e: {}, arr: [], nested: { list: [{}] } };
        const cloned = dataClone(source);

        expect(cloned).toStrictEqual({ e: {}, arr: [], nested: { list: [{}] } });
        expect(cloned.e).not.toBe(source.e);
        expect(cloned.arr).not.toBe(source.arr);
        expect(cloned.nested.list[0]).not.toBe(source.nested.list[0]);
    });
});

describe('dataClone property descriptor handling', () => {
    // The object branch enumerates with `Object.keys`, i.e. OWN ENUMERABLE STRING keys only.
    // Accessors are therefore read (invoked) like any other property, while a non-enumerable
    // own property is invisible and silently dropped from the clone.
    test('should invoke enumerable getters once, clone their result, and drop non-enumerable own props', () => {
        const getterValue = { nested: 1 };
        let getterCalls = 0;

        const source: Record<string, any> = {
            plain: 1,
            get getter() {
                getterCalls += 1;
                return getterValue;
            }
        };
        Object.defineProperty(source, 'hidden', { value: 2, enumerable: false });

        const cloned = dataClone(source);

        // The getter ran exactly once — the clone pass does not re-read the source.
        expect(getterCalls).toBe(1);
        // Exact clone shape: enumerable string keys, in own-key order; `hidden` never copied.
        expect(Object.keys(cloned)).toStrictEqual(['plain', 'getter']);
        expect(cloned).toStrictEqual({ plain: 1, getter: { nested: 1 } });
        expect('hidden' in cloned).toBe(false);
        // The accessor RESULT is deep-cloned, so the clone does not alias the returned object.
        expect(cloned.getter).not.toBe(getterValue);
        expect(cloned.getter.nested).toBe(1);
        expect(cloned).not.toBe(source);
    });

    // `Object.create(null)` has no constructor, so it never reaches the array/object branches
    // (typeSwitch resolved it to the '' -> "null" name; the isObject predicate rejects it).
    // It must stay shared BY REFERENCE, including its nested values, which are never visited.
    test('should return a prototype-less object by reference without recursing into it', () => {
        const nullProto: Record<string, any> = Object.create(null);
        nullProto.inner = { a: 1 };
        Object.defineProperty(nullProto, 'list', { value: [1, 2], enumerable: false });

        const cloned = dataClone(nullProto);

        expect(cloned).toBe(nullProto);
        // No recursion: the nested object is the very same reference, not a copy.
        expect(cloned.inner).toBe(nullProto.inner);
        // A mutation through the "clone" is visible in the source.
        cloned.inner.a = 99;
        expect(nullProto.inner).toStrictEqual({ a: 99 });
    });
});

describe('dataClone circular structures', () => {
    // There is no visited-set (the `cache` parameter is only in the type signature, clone.ts:39),
    // so a self-referencing plain object recurses until the stack blows up.
    test('should throw RangeError for a self-referencing object', () => {
        const circular: Record<string, any> = { a: 1 };
        circular.self = circular;

        expect(() => dataClone(circular)).toThrow(RangeError);
    });

    test('should throw RangeError for a self-referencing array', () => {
        const circular: any[] = [];
        circular.push(circular);

        expect(() => dataClone(circular)).toThrow(RangeError);
    });

    // A Date cycle is safe because Dates are never recursed into.
    test('should not overflow when the cycle is hidden behind a Date reference', () => {
        const date = new Date(0);
        const source = { d: date };

        expect(dataClone(source).d).toBe(date);
    });
});
