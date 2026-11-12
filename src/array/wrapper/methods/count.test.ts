import { arrayWrapper } from '..';

/**
 * `count` contract (src/array/wrapper/methods/count.ts).
 *
 * Regression focus: an unrecognised keyword used to throw
 * `TypeError: checkFunction is not a function`. Per the JSDoc (count.ts:26) it now
 * falls back to counting ALL elements, matching the non-string/default branch.
 * `'object'` was also added to the request union (count.ts:13).
 */
describe('Count function of array Wrapper', () => {
    const $array = arrayWrapper();

    // One fixture exercising every supported keyword:
    // 0 'apple' | 1 'banana' | 2 0 | 3 1 | 4 true | 5 false | 6 null | 7 undefined | 8 {obj} | 9 [9]
    const fixture = ['apple', 'banana', 0, 1, true, false, null, undefined, { obj: 1 }, [9]];

    test('every supported keyword returns an exact count on one mixed fixture', () => {
        // isString / isNumber / isBoolean match the primitive type of the element
        expect($array(fixture).count('string')).toBe(2);
        expect($array(fixture).count('number')).toBe(2);
        expect($array(fixture).count('boolean')).toBe(2);
        // isObject uses typeConstructor === Object, so the [9] entry is NOT an object
        expect($array(fixture).count('object')).toBe(1);
        // isInvalid is strictly null | undefined; 0, false and '' stay valid
        expect($array(fixture).count('invalid')).toBe(2);
        expect($array(fixture).count('valid')).toBe(8);
        // null / undefined keywords are strict equality checks
        expect($array(fixture).count('null')).toBe(1);
        expect($array(fixture).count('undefined')).toBe(1);
    });

    test('omitted request counts every element', () => {
        expect($array(fixture).count()).toBe(10);
        expect($array(fixture).count(undefined as any)).toBe(10);
        expect($array([]).count()).toBe(0);
        expect($array([]).count('invalid')).toBe(0);
    });

    test('unrecognised keyword falls back to counting all elements without throwing', () => {
        // REGRESSION (count.ts:56-62): previously `checkFunction is not a function`
        expect(() => $array(fixture).count('bogus' as any)).not.toThrow();
        expect($array(fixture).count('bogus' as any)).toBe(10);
        // Keywords that exist in `keys`/`is` but not in the count map also fall back
        expect($array(fixture).count('odd' as any)).toBe(10);
        expect($array(fixture).count('array' as any)).toBe(10);
        expect($array(fixture).count('' as any)).toBe(10);
        expect($array([]).count('bogus' as any)).toBe(0);
    });

    test('non-string request counts all elements (default branch)', () => {
        expect($array(fixture).count(null as any)).toBe(10);
        expect($array(fixture).count(123 as any)).toBe(10);
        expect($array(fixture).count(true as any)).toBe(10);
    });

    test('count respects an active select filter', () => {
        // count uses `instance.each`, so select predicates narrow the population
        expect($array(fixture).select([0, 1]).count()).toBe(2);
        // Only index 0 ('apple') survives, so no number matches
        expect($array(fixture).select(0).count('number')).toBe(0);
        expect($array(fixture).select(0).count('string')).toBe(1);
        // Indexes 2 and 3 are the only numbers in the fixture
        expect($array(fixture).select([2, 3]).count('number')).toBe(2);
        // Only index 6 (null) survives, so exactly one invalid element is counted
        expect($array(fixture).select(6).count('invalid')).toBe(1);
        expect($array(fixture).select(6).count()).toBe(1);
        expect($array(fixture).select(6).count('valid')).toBe(0);
        // Unknown keyword combined with a filter still counts the filtered population
        expect($array(fixture).select([2, 3]).count('bogus' as any)).toBe(2);
    });

    test('inherited object keys never masquerade as type checkers (L2)', () => {
        // The hoisted COUNT_CHECKS map (count.ts) is a plain object literal, so an
        // inherited key such as 'constructor' would resolve through the prototype
        // chain without the `objectHasKey` guard. Per the documented contract an
        // unrecognised keyword counts the whole (filtered) population.
        expect($array(fixture).count('constructor' as any)).toBe(10);
        expect($array(fixture).count('toString' as any)).toBe(10);
        expect($array(fixture).count('hasOwnProperty' as any)).toBe(10);
        expect($array(fixture).select([2, 3]).count('constructor' as any)).toBe(2);
    });

    test('legacy fixtures keep their documented counts', () => {
        const example = ['apple', 'banana', 'cat', 'dog', true, true, undefined, 1, 2, 3, 4, 5, 6, 7];
        expect($array(example).count()).toBe(14);
        expect($array(example).count('string')).toBe(4);
        expect($array(example).count('boolean')).toBe(2);
        expect($array(example).count('number')).toBe(7);
        expect($array(example).count('invalid')).toBe(1);
        expect($array(example).count('valid')).toBe(13);

        // Arrays are excluded from the 'object' keyword because isObject compares constructors
        const mixed = ['apple', null, { key: 'val' }, [1, 2], undefined, 'banana'];
        expect($array(mixed).count('null')).toBe(1);
        expect($array(mixed).count('object')).toBe(1);
        expect($array(mixed).count('undefined')).toBe(1);
        expect($array(mixed).count()).toBe(6);
        expect($array(mixed).count('string')).toBe(2);
        expect($array(mixed).count('valid')).toBe(4);
    });
});
