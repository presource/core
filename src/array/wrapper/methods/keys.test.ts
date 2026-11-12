import { arrayWrapper } from '..';

/**
 * `keys` contract (src/array/wrapper/methods/keys.ts).
 *
 * Regression focus: keys.ts:107 must sort with the NUMERIC comparator
 * `(a, b) => a - b`. The previous default `Array#sort()` coerced indexes to
 * strings, so any wrapped array with 10+ elements produced
 * [0,1,10,11,2,...] and every consumer (`get`, `remove`) inherited the shuffle.
 */
describe('For extracting keys from an array function', () => {
    const $array = arrayWrapper();

    // 12 elements: the smallest fixture where lexicographic and numeric ordering differ
    const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    // Nullish values sit on indexes 0, 2, 4 so `valid`/`invalid` split the fixture cleanly
    const mixedNull = [null, 1, undefined, 2, null, 3];
    // Truthiness fixture: '' and 0 and false are falsey, 1 and true are truthy
    const boolies = [1, 0, true, false, ''];

    test('default request returns every index in strict ascending numeric order', () => {
        // REGRESSION (keys.ts:104-107): before the numeric comparator this came back
        // as [0,1,10,11,2,3,4,5,6,7,8,9] because Array#sort compares strings.
        expect($array(twelve).keys()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect($array(letters).keys()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        // Pin the exact buggy ordering as a negative assertion so a comparator change cannot regress silently
        expect($array(twelve).keys()).not.toStrictEqual([0, 1, 10, 11, 2, 3, 4, 5, 6, 7, 8, 9]);
        // Omitted request and an unmatched (default-branch) request are the same path
        expect($array(letters).keys(undefined as any)).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        // Nullish request falls through typeSwitch `default` => all indexes
        expect($array(twelve).keys(null as any)).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('odd and even keywords stay ascending with two-digit indexes', () => {
        expect($array(twelve).keys('odd')).toStrictEqual([1, 3, 5, 7, 9, 11]);
        expect($array(twelve).keys('even')).toStrictEqual([0, 2, 4, 6, 8, 10]);
        // Index 10 would land after 1 and before 11 under the old lexicographic sort
        expect($array(letters).keys('even')).toStrictEqual([0, 2, 4, 6, 8, 10]);

        // Legacy <10 element fixtures keep the documented values (order-agnostic there)
        const example = ['apple', 'banana', 'cat', 'dog', true, false, 0, 1, 2, 3];
        expect($array(example).keys('odd')).toStrictEqual([1, 3, 5, 7, 9]);
        expect($array(example).keys('even')).toStrictEqual([0, 2, 4, 6, 8]);
    });

    test('valid and invalid keywords split on nullish values only', () => {
        // isInvalid === null | undefined, so 0 / false / '' remain "valid"
        expect($array(mixedNull).keys('valid')).toStrictEqual([1, 3, 5]);
        expect($array(mixedNull).keys('invalid')).toStrictEqual([0, 2, 4]);
        expect($array(boolies).keys('valid')).toStrictEqual([0, 1, 2, 3, 4]);
        expect($array(boolies).keys('invalid')).toStrictEqual([]);

        const legacy = [null, undefined, 0, false, true, 1, 'apple'];
        expect($array(legacy).keys('valid')).toStrictEqual([2, 3, 4, 5, 6]);
        expect($array(legacy).keys('invalid')).toStrictEqual([0, 1]);
    });

    test('boolean request matches by element truthiness', () => {
        // keys.ts:80 compares `value === !!data.value`; falsey set is 0, '' and false
        expect($array(boolies).keys(true)).toStrictEqual([0, 2]);
        expect($array(boolies).keys(false)).toStrictEqual([1, 3, 4]);

        const example = ['apple', 'banana', 'cat', 'dog', true, false, 0, 1, 2, 3];
        expect($array(example).keys(true)).toStrictEqual([0, 1, 2, 3, 4, 7, 8, 9]);
        expect($array(example).keys(false)).toStrictEqual([5, 6]);
    });

    test('number request matches one exact index, in and out of range', () => {
        expect($array(twelve).keys(0)).toStrictEqual([0]);
        expect($array(twelve).keys(2)).toStrictEqual([2]);
        // Two-digit index must survive the sort to be usable by get()/remove()
        expect($array(twelve).keys(10)).toStrictEqual([10]);
        expect($array(twelve).keys(11)).toStrictEqual([11]);
        // Out-of-range indexes match nothing (never an empty element hole)
        expect($array(twelve).keys(99)).toStrictEqual([]);
        expect($array(twelve).keys(-1)).toStrictEqual([]);
    });

    test('unknown keyword resolves to no keys instead of throwing', () => {
        // stringSwitch has no `default` entry here, so an unknown keyword yields an empty Set
        expect($array(twelve).keys('bogus')).toStrictEqual([]);
        expect($array(twelve).keys('array')).toStrictEqual([]);
        expect($array(boolies).keys('')).toStrictEqual([]);
    });

    test('array request unions every sub-criterion deduped and ascending', () => {
        // 'odd' => 1,3,5,7,9,11; 10 and 11 are extra criteria (11 dedupes)
        expect($array(twelve).keys(['odd', 10, 11])).toStrictEqual([1, 3, 5, 7, 9, 10, 11]);
        // 'even' => 0,2,4,6,8,10; number 1 adds one index; number 10 dedupes
        expect($array(twelve).keys(['even', 1, 10])).toStrictEqual([0, 1, 2, 4, 6, 8, 10]);
        expect($array(twelve).keys(['odd', 'even'])).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        // Repeated criteria collapse through the Set
        expect($array(letters).keys([true, 2, 2, 'odd'])).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        // Union of two string keywords: 'x' at index 6 is valid but even, so it is excluded
        expect($array([null, 1, undefined, 2, null, 3, 'x']).keys(['invalid', 'odd'])).toStrictEqual([0, 1, 2, 3, 4, 5]);

        // Legacy fixture: index 2 (null) is neither odd nor valid, so it is absent
        const mixed = ['apple', 'banana', null, undefined, false, true, 0, 1, 2, 3];
        expect($array(mixed).keys([true, false])).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect($array(mixed).keys(['odd', 'even'])).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect($array(mixed).keys(['odd', 'valid'])).toStrictEqual([0, 1, 3, 4, 5, 6, 7, 8, 9]);
    });

    test('empty array yields no keys for every request shape', () => {
        expect($array([]).keys()).toStrictEqual([]);
        expect($array([]).keys('odd')).toStrictEqual([]);
        expect($array([]).keys('valid')).toStrictEqual([]);
        expect($array([]).keys(true)).toStrictEqual([]);
        expect($array([]).keys(2)).toStrictEqual([]);
        expect($array([]).keys(['odd', 2])).toStrictEqual([]);
    });

    test('legacy 10 element fixture keeps its documented basic values', () => {
        const example = ['apple', 'banana', 'cat', 'dog', true, false, 0, 1, 2, 3];
        const wrapper = $array(example);
        expect(wrapper.keys()).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(wrapper.keys(true)).toStrictEqual([0, 1, 2, 3, 4, 7, 8, 9]);
        expect(wrapper.keys(false)).toStrictEqual([5, 6]);
    });

    test('a mixed criteria array resolves to the union in one pass (H2)', () => {
        // 'even' => 0,2,4,6,8,10 | 7 => 7 | false => index 0 only (its value 0 is
        // the single falsey element of `twelve`)
        expect($array(twelve).keys(['even', 7, false])).toStrictEqual([0, 2, 4, 6, 7, 8, 10]);
        // 'odd' => 1,3,5,7,9,11 | 'invalid' => nothing (no nullish element) | 10 => 10
        expect($array(twelve).keys(['odd', 'invalid', 10])).toStrictEqual([1, 3, 5, 7, 9, 10, 11]);
        // 'invalid' => 0,2,4 | false => the same nullish indexes | 1 => 1
        expect($array(mixedNull).keys(['invalid', false, 1])).toStrictEqual([0, 1, 2, 4]);
        // 'valid' => 1,3,5 | true => the same truthy indexes | 4 => 4 (null is still an index hit)
        expect($array(mixedNull).keys(['valid', true, 4])).toStrictEqual([1, 3, 4, 5]);
    });

    test('non-selectable criteria contribute nothing to the union', () => {
        // The old nested dispatch only declared number/boolean/string cases, so
        // every other criterion shape silently selects nothing (no `default`).
        expect($array(twelve).keys([])).toStrictEqual([]);
        expect($array(twelve).keys([{}])).toStrictEqual([]);
        expect($array(twelve).keys([[]])).toStrictEqual([]);
        expect($array(twelve).keys([null, undefined])).toStrictEqual([]);
        expect($array(twelve).keys(['bogus'])).toStrictEqual([]);
        // A non-selectable criterion next to a real one changes nothing
        expect($array(twelve).keys(['bogus', 'odd'])).toStrictEqual([1, 3, 5, 7, 9, 11]);
        expect($array(twelve).keys([{}, true])).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });

    test('numbers outside the index domain select nothing', () => {
        // No iteration index is ever 1.5/NaN/-1/99, so these stay empty.
        expect($array(twelve).keys(1.5)).toStrictEqual([]);
        expect($array(twelve).keys(NaN)).toStrictEqual([]);
        expect($array(twelve).keys(-1)).toStrictEqual([]);
        // `-0` is SameValueZero-equal to index 0 (Set lookup) and `0 === -0`, so
        // both the Set and the old `index === value` compare select index 0.
        expect($array(twelve).keys(-0)).toStrictEqual([0]);
        // Only the in-domain criterion of the union survives
        expect($array(twelve).keys([1.5, NaN, -1, 3])).toStrictEqual([3]);
    });

    test('three-digit indexes stay ascending and unique without a post-sort (H2)', () => {
        // 120 elements: lexicographic ordering would put 100/101/11 before 2/12.
        const bigger = Array.from({ length: 120 }, (_, index) => index);
        const odds = Array.from({ length: 60 }, (_, index) => 2 * index + 1);
        const evens = Array.from({ length: 60 }, (_, index) => 2 * index);
        // The single ascending collection pass produces these already sorted.
        expect($array(bigger).keys('odd')).toStrictEqual(odds);
        expect($array(bigger).keys('even')).toStrictEqual(evens);
        expect($array(bigger).keys([100, 11, 2])).toStrictEqual([2, 11, 100]);
        // Repeated criteria collapse: 5 and 111 are already in the odd set
        expect($array(bigger).keys([111, 5, 5, 111, 'odd'])).toStrictEqual(odds);
        // Index 0 holds the value 0 (falsey), so `true` selects 1..119 only
        expect($array(bigger).keys(true)).toStrictEqual(Array.from({ length: 119 }, (_, index) => index + 1));
    });

    test('holes are visited and judged by their undefined value', () => {
        // `arrayEach` (src/array/each.ts:79-84) reads list[i] for every i, so a
        // hole behaves exactly like an explicit `undefined` entry.
        const holes = [1, , 3];
        expect($array(holes).keys()).toStrictEqual([0, 1, 2]);
        expect($array(holes).keys('invalid')).toStrictEqual([1]);
        expect($array(holes).keys('valid')).toStrictEqual([0, 2]);
        expect($array(holes).keys(true)).toStrictEqual([0, 2]);
        expect($array(holes).keys(false)).toStrictEqual([1]);
        // A plain index criterion still hits the hole, because the pass visits it
        expect($array(holes).keys(1)).toStrictEqual([1]);
        expect($array(holes).keys(['invalid', 'odd'])).toStrictEqual([1]);
    });

    test('an explicit config filter narrows every criterion shape', () => {
        // Root config filters go through the same `each` pass as `select` ones, so
        // every criterion must be judged against the filtered population only.
        const visible = $array(twelve, { filter: [(data: any) => data.index < 3] });
        expect(visible.keys()).toStrictEqual([0, 1, 2]);
        expect(visible.keys(1)).toStrictEqual([1]);
        // 5 is a real index but the filter hides it, so the criterion matches nothing
        expect(visible.keys(5)).toStrictEqual([]);
        expect(visible.keys('odd')).toStrictEqual([1]);
        // index 0 (value 0) is the only falsey element of the visible window
        expect(visible.keys(true)).toStrictEqual([1, 2]);
        expect(visible.keys(false)).toStrictEqual([0]);
        // 9 is hidden by the filter even though it is a valid index criterion
        expect(visible.keys(['even', 9])).toStrictEqual([0, 2]);
    });

    test('extra criteria never add another iteration pass (H2)', () => {
        const visits = vi.fn(() => true);
        const wrapper = $array(twelve, { filter: [visits] });
        // The filter predicate runs once per element per keys() call, so a single
        // pass over the 12-element fixture is exactly 12 calls. Before the H2 fix
        // these 8 criteria ran one full pass each, i.e. 96 calls.
        expect(wrapper.keys(['odd', 'even', 'valid', 'invalid', true, false, 0, 10])).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
        expect(visits.mock.calls.length).toBe(12);
        visits.mockClear();
        wrapper.keys(3);
        expect(visits.mock.calls.length).toBe(12);
        visits.mockClear();
        // Requests with nothing selectable never iterate at all
        wrapper.keys('bogus');
        expect(visits.mock.calls.length).toBe(0);
    });
});
