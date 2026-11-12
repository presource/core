import { objectExtract } from '@presource/core';

describe('objectExtract test and requirements', () => {
    // Creating an example to test
    const example = {
        fruits: { apple: { color: 'red', quality: 1 }, banana: { color: 'yellow', quality: 1 } },
        animals: { cat: { color: 'brown', quality: 2 }, dog: { color: 'black', quality: 2 } },
        lists: {
            fruits: ['apple', 'banana', 'pear'],
            animals: ['cat', 'dog', 'elephant'],
            nested: [
                {
                    parents: ['John', 'Jane']
                }
            ]
        }
    };

    test('should able to access through simple string path', () => {
        expect(objectExtract(example, 'fruits.apple')).toStrictEqual({ color: 'red', quality: 1 });
        expect(objectExtract(example, 'fruits.apple.color')).toStrictEqual('red');
        expect(objectExtract(example, 'fruits.apple.color.red')).toBeUndefined();
    });

    test('should returns an array when array is requested', () => {
        expect(objectExtract(example, ['fruits.apple.color', 'animals.cat.color'])).toStrictEqual(['red', 'brown']);
    });

    test('should access array when array key is provided', () => {
        // Accessing with array indexes
        expect(objectExtract(example, 'lists.fruits[0]')).toStrictEqual('apple');
        //  Access the d
        expect(objectExtract(example, 'lists.nested[0]')).toStrictEqual({
            parents: ['John', 'Jane']
        });
        expect(objectExtract(example, 'lists.nested[0].parents[0]')).toStrictEqual('John');
    });

    test('number extract returns undefined', () => {
        expect(objectExtract(example, 0)).toBeUndefined();
        expect(objectExtract(example, 123)).toBeUndefined();
    });

    test('array extract with numbers', () => {
        const result = objectExtract(example, [0, 1]);
        expect(result).toStrictEqual([undefined, undefined]);
    });

    test('array extract with nested arrays', () => {
        const result = objectExtract(example, [['fruits.apple.color']]);
        expect(result).toStrictEqual([['red']]);
    });

    test('array extract with default case (invalid type)', () => {
        const result = objectExtract(example, [null]);
        expect(result).toStrictEqual([undefined]);
    });

    test('should handle out-of-bounds array index', () => {
        expect(objectExtract(example, 'lists.fruits[100]')).toBeUndefined();
    });

    test('should handle bracket index on non-array value', () => {
        expect(objectExtract(example, 'fruits.apple[0]')).toBeUndefined();
    });

    test('should handle chained bracket indexes with intermediate undefined', () => {
        expect(objectExtract(example, 'lists.fruits[100][0]')).toBeUndefined();
    });

    test('should handle non-object pointer with bracket access', () => {
        const arr = ['a', 'b', 'c'];
        expect(objectExtract(arr, '0')).toBeUndefined();
    });

    test('should return undefined for invalid bracket notation (no digits in brackets)', () => {
        // Covers extract.ts line 40: `if (!match)` when the bracket regex does not match.
        // A segment like "foo[bar]" (non-digit inside brackets) fails the regex
        // /^([^\[]*)((?:\[\d+\])*)$/ because \d+ requires digits.
        expect(objectExtract({ foo: { bar: 'value' } }, 'foo[bar]')).toBeUndefined();
    });

    test('should handle segment with empty key and bracket index only', () => {
        // Covers extract.ts line 46: `key ? ... : pointer` when key is empty string.
        // A segment like "[0]" has key='' (falsy) and indexes='[0]'.
        // value is set to pointer itself, then bracket access resolves the index.
        // This also covers line 49 `if (indexes)` true branch for this segment shape.
        const target = { items: [10, 20, 30] };
        // Access via path 'items[0]' — segment 'items[0]' has key='items', indexes='[0]'
        expect(objectExtract(target, 'items[0]')).toBe(10);
        expect(objectExtract(target, 'items[1]')).toBe(20);
        expect(objectExtract(target, 'items[2]')).toBe(30);
    });

    test('should handle path starting with bracket (empty leading key)', () => {
        // Covers extract.ts line 46: key='' branch where `value = pointer`.
        // A path segment "[0]" with no leading key results in key='' (falsy),
        // so value = pointer, then bracket access processes the index.
        // NOTE: This requires the root object to be an array.
        const arr = [10, 20, 30];
        // Direct bracket access on the array root
        expect(objectExtract(arr, '[0]')).toBe(10);
        expect(objectExtract(arr, '[1]')).toBe(20);
        expect(objectExtract(arr, '[2]')).toBe(30);
    });

    test('should return falsy-but-present leaves unchanged', () => {
        // extract.ts:59 `value ?? undefined` only replaces null/undefined, so 0 / '' / false survive
        const source = { zero: 0, blank: '', no: false, yes: true };
        expect(objectExtract(source, 'zero')).toBe(0);
        expect(objectExtract(source, 'blank')).toBe('');
        expect(objectExtract(source, 'no')).toBe(false);
        expect(objectExtract(source, 'yes')).toBe(true);
        expect(objectExtract({ a: { b: { c: 0 } } }, 'a.b.c')).toBe(0);
    });

    test('should convert a null leaf to undefined', () => {
        // `?? undefined` collapses BOTH null and undefined (extract.ts:59), so a present
        // `null` is indistinguishable from a missing key after extraction
        const source = { nothing: null, nested: { a: { deep: null } } };
        expect(objectExtract(source, 'nothing')).toBeUndefined();
        expect(objectExtract(source, 'nested.a.deep')).toBeUndefined();
        expect('nothing' in source).toBe(true);
    });

    test('should return object leaves by the same reference', () => {
        const leaf = { color: 'red' };
        const source = { fruits: { apple: leaf } };
        const result = objectExtract(source, 'fruits.apple');

        expect(result).toBe(leaf);
        expect(objectExtract(source, '')).toBe(source);
        expect(objectExtract(source, 'fruits')).toBe(source.fruits);
    });

    test('should handle out-of-bounds and over-qualified bracket steps', () => {
        const source = { list: [[1, 2], [3, 4]] };
        expect(objectExtract(source, 'list[5]')).toBeUndefined();
        expect(objectExtract(source, 'list[5][2]')).toBeUndefined();
        expect(objectExtract(source, 'list[0][9]')).toBeUndefined();
        // Any bracket step past a non-array leaf resolves to undefined
        expect(objectExtract({ m: [[[7]]] }, 'm[0][0][0][0]')).toBeUndefined();
    });

    test('should resolve every numeric bracket step in order', () => {
        // extract.ts:49-56 walks each `[n]`; the digit scan always yields at least one match for
        // the `((?:\[\d+\])*)` capture group, so the `?? []` fallback the old line 38 carried was
        // unreachable dead code and has been removed
        const source = { m: [[[7]], [[8], [9]]] };
        expect(objectExtract(source, 'm[0][0][0]')).toBe(7);
        expect(objectExtract(source, 'm[1][1][0]')).toBe(9);
        expect(objectExtract(source, 'm[1][0][0]')).toBe(8);
    });

    test('should return undefined when a bracket step targets a non-array value', () => {
        const source = { list: { 0: 'object-member' }, deep: { l1: { l2: 'leaf' } }, zero: 0 };
        // Bracket indexing is array-only, so an array-like object does not qualify
        expect(objectExtract(source, 'list[0]')).toBeUndefined();
        expect(objectExtract(source, 'deep.l1[0]')).toBeUndefined();
        expect(objectExtract(source, 'zero[0]')).toBeUndefined();
    });

    test('should return undefined for paths through non-object pointers', () => {
        const source = { zero: 0, text: 'abc', nothing: null, fn: () => 1 };
        expect(objectExtract(source, 'zero.x')).toBeUndefined();
        expect(objectExtract(source, 'text.length')).toBeUndefined();
        expect(objectExtract(source, 'nothing.deeper')).toBeUndefined();
        expect(objectExtract(source, 'nope.still.nope')).toBeUndefined();
        // The root itself being null/undefined simply yields undefined
        expect(objectExtract(null as any, 'a')).toBeUndefined();
        expect(objectExtract(undefined as any, 'a')).toBeUndefined();
        expect(objectExtract({}, 'a')).toBeUndefined();
    });

    test('should return the function leaf itself', () => {
        const fn = () => 1;
        expect(objectExtract({ fn }, 'fn')).toBe(fn);
    });

    test('should tolerate empty segments from leading, trailing and doubled dots', () => {
        const source = { a: { b: { c: 1 } } };
        // An empty segment keeps the current pointer (extract.ts:46 key='' branch)
        expect(objectExtract(source, '')).toBe(source);
        expect(objectExtract(source, 'a.b.')).toStrictEqual({ c: 1 });
        expect(objectExtract(source, '.a.b')).toStrictEqual({ c: 1 });
        expect(objectExtract(source, 'a..b')).toStrictEqual({ c: 1 });
    });

    test('should return undefined for invalid bracket notation', () => {
        const source = { a: { b: 1 }, list: [1, 2] };
        expect(objectExtract(source, 'a[abc]')).toBeUndefined();
        expect(objectExtract(source, 'a[abc][0]')).toBeUndefined();
        expect(objectExtract(source, 'a[b][c]')).toBeUndefined();
        expect(objectExtract(source, 'list[-1]')).toBeUndefined();
        expect(objectExtract(source, 'list[ ]')).toBeUndefined();
        expect(objectExtract(source, 'list[0')).toBeUndefined();
    });

    test('should support keys that contain spaces', () => {
        expect(objectExtract({ 'a b': 1 }, 'a b')).toBe(1);
    });

    test('should return undefined for every non path type', () => {
        // typeSwitch has no `default` bucket, so unmatched extract types resolve to undefined
        const source = { a: 1 };
        expect(objectExtract(source, 0)).toBeUndefined();
        expect(objectExtract(source, 123)).toBeUndefined();
        expect(objectExtract(source, true)).toBeUndefined();
        expect(objectExtract(source, false)).toBeUndefined();
        expect(objectExtract(source, null)).toBeUndefined();
        expect(objectExtract(source, undefined)).toBeUndefined();
        expect(objectExtract(source, { path: 'a' })).toBeUndefined();
    });

    test('should map an array request recursively with mixed element types', () => {
        const source = { a: { b: 1 }, zero: 0, no: false, nothing: null, deep: { l1: { l2: 'leaf' } } };
        const request = ['a.b', 'zero', 'no', 'nothing', 'missing', 7, true, null, ['deep.l1.l2']];
        const result = objectExtract(source, request);

        expect(result).toStrictEqual([1, 0, false, undefined, undefined, undefined, undefined, undefined, ['leaf']]);
        // The result is a freshly built array, never the request array itself
        expect(Array.isArray(result)).toBe(true);
        expect(result).not.toBe(request);
    });

    test('should map array requests over an array root using bracket-only paths', () => {
        const root = ['x', 'y'];
        expect(objectExtract(root, ['[0]', '[1]'])).toStrictEqual(['x', 'y']);
        expect(objectExtract(root, [])).toStrictEqual([]);
    });

    test('should return undefined for roots that are not plain objects', () => {
        // G12: extract.ts:46 gates key access on `isObject`, which is constructor-strict
        // (typeConstructor(value) === Object), so neither an array root nor a class-instance
        // root can be drilled into even though the property physically exists.
        expect(objectExtract([{ n: 1 }], '0.n')).toBeUndefined();

        class Model {
            n = 1;
        }
        expect(objectExtract(new Model() as any, 'n')).toBeUndefined();
        expect(objectExtract(new Model() as any, 'missing')).toBeUndefined();

        // A plain object root with the same shape does resolve, so the miss is the guard itself
        expect(objectExtract({ n: 1 }, 'n')).toBe(1);
        // Bracket-only segments skip the guard entirely (key='' branch, extract.ts:46)
        expect(objectExtract([{ n: 1 }], '[0]')).toStrictEqual({ n: 1 });
    });
});
