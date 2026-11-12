import { arrayWrapper } from '..';

/**
 * `get` contract (src/array/wrapper/methods/get.ts).
 *
 * `get` delegates to `instance.keys(request)` (get.ts:30) and maps the resolved
 * indexes onto the element array, so the numeric-comparator fix in keys.ts:107
 * is observable here as true index ordering of the returned elements.
 */
describe('Get Function of Array Wrapper', () => {
    const $array = arrayWrapper();

    // 12 elements expose the lexicographic ordering bug that `get` inherits from `keys`
    const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const mixedNull = [null, 1, undefined, 2, null, 3];

    test('returns elements in true index order for 10+ element arrays', () => {
        // REGRESSION: with the old string sort this returned
        // [0, 1, 10, 11, 2, 3, 4, 5, 6, 7, 8, 9]
        expect($array(twelve).get()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect($array(letters).get()).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
        expect($array(twelve).get()).not.toStrictEqual([0, 1, 10, 11, 2, 3, 4, 5, 6, 7, 8, 9]);
        // Two-digit index requests resolve as well
        expect($array(letters).get(10)).toStrictEqual(['k']);
        expect($array(letters).get(11)).toStrictEqual(['l']);
    });

    test('single number request returns exactly that index', () => {
        expect($array(twelve).get(0)).toStrictEqual([0]);
        expect($array(twelve).get(2)).toStrictEqual([2]);
        expect($array(twelve).get(11)).toStrictEqual([11]);
        // Out-of-range request matches no key, so no element and no `undefined` hole
        expect($array(twelve).get(99)).toStrictEqual([]);
        expect($array(twelve).get(-1)).toStrictEqual([]);
    });

    test('string keyword requests filter by trait', () => {
        expect($array(twelve).get('odd')).toStrictEqual([1, 3, 5, 7, 9, 11]);
        expect($array(twelve).get('even')).toStrictEqual([0, 2, 4, 6, 8, 10]);
        // valid/invalid key on nullish values only
        expect($array(mixedNull).get('valid')).toStrictEqual([1, 2, 3]);
        expect($array(mixedNull).get('invalid')).toStrictEqual([null, undefined, null]);
        // Unknown keyword resolves to no keys => no elements
        expect($array(twelve).get('bogus')).toStrictEqual([]);
    });

    test('array requests union the sub-criteria and collapse duplicates', () => {
        expect($array(twelve).get(['odd'])).toStrictEqual([1, 3, 5, 7, 9, 11]);
        expect($array(mixedNull).get(['valid'])).toStrictEqual([1, 2, 3]);
        // Duplicate criteria (odd twice plus an index already odd) collapse through keys()
        expect($array(twelve).get(['odd', 'odd', 1])).toStrictEqual([1, 3, 5, 7, 9, 11]);
        // valid => 1,3,5 and even => 0,2,4 covers the whole fixture in ascending order
        expect($array(mixedNull).get(['valid', 'even'])).toStrictEqual([null, 1, undefined, 2, null, 3]);
    });

    test('empty array returns an empty array', () => {
        expect($array([]).get()).toStrictEqual([]);
        expect($array([]).get('valid')).toStrictEqual([]);
        expect($array([]).get(0)).toStrictEqual([]);
    });

    test('result is a fresh array, never a reference to the source', () => {
        const source = [...twelve];
        const result = $array(source).get();
        // get.ts:32 maps indexes into a new array; mutating it must not touch the source
        expect(result).not.toBe(source);
        result.push('appended');
        expect(source).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(result).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 'appended']);
    });

    test('legacy fixture keeps its documented basic values', () => {
        const example = ['apple', 'banana', 'cat', 'dog', true, false, 0, 1, 2, 3];
        expect($array(example).get()).toStrictEqual(['apple', 'banana', 'cat', 'dog', true, false, 0, 1, 2, 3]);
        expect($array(example).get(true)).toStrictEqual(['apple', 'banana', 'cat', 'dog', true, 1, 2, 3]);
        expect($array(example).get(false)).toStrictEqual([false, 0]);
        expect($array(example).get('odd')).toStrictEqual(['banana', 'dog', false, 1, 3]);
        expect($array(example).get('even')).toStrictEqual(['apple', 'cat', true, 0, 2]);

        const legacyMixed = [null, undefined, 0, false, true, 1, 'apple'];
        expect($array(legacyMixed).get('valid')).toStrictEqual([0, false, true, 1, 'apple']);
        expect($array(legacyMixed).get('invalid')).toStrictEqual([null, undefined]);

        const mixed = ['apple', 'banana', null, undefined, false, true, 0, 1, 2, 3];
        expect($array(mixed).get([true, false])).toStrictEqual(['apple', 'banana', null, undefined, false, true, 0, 1, 2, 3]);
        expect($array(mixed).get(['odd', 'even'])).toStrictEqual(['apple', 'banana', null, undefined, false, true, 0, 1, 2, 3]);
        // Index 2 (null) is neither odd nor valid, so it is absent; index 3 (undefined) comes from 'odd'
        expect($array(mixed).get(['odd', 'valid'])).toStrictEqual(['apple', 'banana', undefined, false, true, 0, 1, 2, 3]);
    });
});
