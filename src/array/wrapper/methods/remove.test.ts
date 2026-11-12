import { arrayWrapper } from '..';

/**
 * `remove` contract (src/array/wrapper/methods/remove.ts).
 *
 * `remove` splices the resolved keys out of the WRAPPED ARRAY ITSELF (remove.ts:33-37)
 * and returns the wrapper for chaining. Because keys.ts:107 now sorts numerically,
 * the ascending splice loop with `pointer = value - index` is correct for any request
 * order — including indexes >= 10, which the old string sort corrupted.
 */
describe('Remove functionality of array Wrapper', () => {
    const $array = arrayWrapper();
    const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const sample = ['apple', 'banana', true, false, 0, 1, 2, null, undefined];

    test('removal mutates the underlying element array in place', () => {
        const source = [...twelve];
        const wrapper = $array(source);
        const returned = wrapper.remove(0);
        // Same array reference, spliced (not replaced)
        expect(source).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        // The wrapper reads the mutated array
        expect(wrapper.get()).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(wrapper.keys()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        // remove returns the very same wrapper instance for chaining
        expect(returned).toBe(wrapper);
        expect(returned.remove(0).get()).toStrictEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(source).toStrictEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('descending and ascending index requests remove the same elements', () => {
        // REGRESSION (keys.ts:104-107): with the lexicographic sort, keys([10, 0]) came
        // back as [0, 10] by luck but keys([2, 10]) as [10, 2], so the pointer offset
        // spliced the wrong slots and left index 1 missing instead of index 2.
        const descending = [...twelve];
        const ascending = [...twelve];
        $array(descending).remove([10, 0]);
        $array(ascending).remove([0, 10]);
        expect(descending).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);
        expect(ascending).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);

        const otherDescending = [...twelve];
        const otherAscending = [...twelve];
        $array(otherDescending).remove([2, 10]);
        $array(otherAscending).remove([10, 2]);
        expect(otherDescending).toStrictEqual([0, 1, 3, 4, 5, 6, 7, 8, 9, 11]);
        expect(otherAscending).toStrictEqual([0, 1, 3, 4, 5, 6, 7, 8, 9, 11]);
    });

    test('removes every requested index including two-digit ones', () => {
        const a = [...twelve];
        $array(a).remove([11, 10, 0]);
        expect(a).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

        const asc = [...twelve];
        const desc = [...twelve];
        $array(asc).remove([0, 1, 2]);
        $array(desc).remove([2, 1, 0]);
        expect(asc).toStrictEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(desc).toStrictEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('keyword request removes by trait', () => {
        const odd = [...twelve];
        $array(odd).remove('odd');
        expect(odd).toStrictEqual([0, 2, 4, 6, 8, 10]);

        // 'even' then 'odd' in one request removes everything
        const all = [...twelve];
        $array(all).remove(['even', 'odd']);
        expect(all).toStrictEqual([]);

        const invalid = [...sample];
        $array(invalid).remove('invalid');
        expect(invalid).toStrictEqual(['apple', 'banana', true, false, 0, 1, 2]);

        const valid = [...sample];
        $array(valid).remove('valid');
        expect(valid).toStrictEqual([null, undefined]);
    });

    test('boolean request removes by element truthiness', () => {
        const falsey = [...sample];
        $array(falsey).remove(false);
        expect(falsey).toStrictEqual(['apple', 'banana', true, 1, 2]);

        const truthy = [...sample];
        $array(truthy).remove(true);
        expect(truthy).toStrictEqual([false, 0, null, undefined]);
    });

    test('empty request list, out-of-range index and unknown keyword remove nothing', () => {
        const emptyRequest = [...twelve];
        $array(emptyRequest).remove([]);
        expect(emptyRequest).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

        const outOfRange = [...twelve];
        $array(outOfRange).remove(99);
        expect(outOfRange).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

        const unknownKeyword = [...twelve];
        $array(unknownKeyword).remove('bogus');
        expect(unknownKeyword).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('omitted request removes every element', () => {
        const example = ['apple', 'banana', 'cat', 'dog', 'elephant'];
        // No request hits the keys() default branch => all indexes => array is emptied
        $array(example).remove();
        expect(example).toStrictEqual([]);

        const empty = [...twelve];
        $array(empty).remove(['even', 'odd']);
        expect(empty).toStrictEqual([]);
    });

    test('removal is driven by the active select filter', () => {
        const twelveSource = [...twelve];
        // The derived wrapper only exposes indexes 0 and 11, so only those are spliced
        $array(twelveSource).select([0, 11]).remove();
        expect(twelveSource).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        const partial = [...twelve];
        // The filter narrows which indexes keys() can see; the surviving indexes are
        // then spliced with the `value - index` offset, so only filtered-out indexes stay
        $array(partial).select([0, 1, 2, 3]).remove('odd');
        expect(partial).toStrictEqual([0, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('legacy fixtures keep their documented removals', () => {
        const fruits = ['apple', 'banana', 'cat', 'dog', 'elephant', true, false, null, undefined, 1, 2, 3, 4, 5];
        $array(fruits).remove(0);
        expect(fruits).toStrictEqual(['banana', 'cat', 'dog', 'elephant', true, false, null, undefined, 1, 2, 3, 4, 5]);

        const listed = ['apple', 'banana', 'cat', 'dog', 'elephant', true, false, null, undefined, 1, 2, 3, 4, 5];
        $array(listed).remove([1, 2, 3]);
        expect(listed).toStrictEqual(['apple', 'elephant', true, false, null, undefined, 1, 2, 3, 4, 5]);
    });

    test('shifted holes stay holes and never become undefined entries (H3)', () => {
        // Reference behavior was captured against the pre-fix `splice` loop in
        // Temp/coding-wrapper/sparse-probe.ts: `Array#splice` moved a hole as a
        // hole, so the compaction must not materialise it into the array.
        const shifted = [1, , 3];
        $array(shifted).remove(0);
        expect(shifted.length).toBe(2);
        // index 0 is a genuine hole, index 1 holds the shifted value 3
        expect(0 in shifted).toBe(false);
        expect(1 in shifted).toBe(true);
        expect(shifted[1]).toBe(3);
        expect(Reflect.ownKeys(shifted).map(String)).toStrictEqual(['1', 'length']);

        // A hole in the untouched prefix must not be rewritten either
        const prefix = [1, , 3];
        $array(prefix).remove(2);
        expect(prefix.length).toBe(2);
        expect(1 in prefix).toBe(false);
        expect(Reflect.ownKeys(prefix).map(String)).toStrictEqual(['0', 'length']);
    });

    test('nullish keyword removal collapses holes out of a sparse array (H3)', () => {
        // `keys('invalid')` visits holes (they read as undefined), so indexes 1
        // and 2 are dropped and only the two real values remain, densely packed.
        const sparse = [1, , , 4];
        $array(sparse).remove('invalid');
        expect(sparse.length).toBe(2);
        expect(sparse[0]).toBe(1);
        expect(sparse[1]).toBe(4);
        expect(Reflect.ownKeys(sparse).map(String)).toStrictEqual(['0', '1', 'length']);

        // An explicit `undefined` entry is a defined slot, and it is dropped too
        const explicit = [1, undefined, 3];
        $array(explicit).remove('invalid');
        expect(explicit).toStrictEqual([1, 3]);
    });

    test('non-index own properties survive the truncation (H3)', () => {
        // `splice` never touched them and neither does the compaction; only the
        // stale index slots in the tail are removed by the `length` write.
        const source: any = [1, 2, 3];
        source.extra = 'kept';
        $array(source).remove(0);
        expect(source.length).toBe(2);
        expect(source[0]).toBe(2);
        expect(source[1]).toBe(3);
        expect(source.extra).toBe('kept');
        expect(Reflect.ownKeys(source).map(String)).toStrictEqual(['0', '1', 'length', 'extra']);
    });

    test('removing everything leaves an empty array with no index properties', () => {
        const source = [...twelve];
        $array(source).remove();
        expect(source.length).toBe(0);
        // Truncating `length` deletes every stale index slot, exactly like the
        // k splices did, so the array owns nothing but its `length`.
        expect(Reflect.ownKeys(source).map(String)).toStrictEqual(['length']);
    });

    test('duplicate, unordered and out-of-range index requests remove each slot once', () => {
        // The removal Set makes the result independent of the order and the
        // uniqueness of the resolved keys (99 never matches an iteration index).
        const source = [...twelve];
        $array(source).remove([3, 3, 1, 11, 99]);
        expect(source).toStrictEqual([0, 2, 4, 5, 6, 7, 8, 9, 10]);
        expect(source.length).toBe(9);
    });

    test('a 1000 element removal compacts to the exact expected array (H3)', () => {
        // O(n) instead of O(n*k): every even index is dropped in one pass.
        const big = Array.from({ length: 1000 }, (_, index) => index);
        const wrapper = $array(big);
        expect(wrapper.remove('even')).toBe(wrapper);
        expect(big).toStrictEqual(Array.from({ length: 500 }, (_, index) => 2 * index + 1));
        expect(big.length).toBe(500);
    });
});
