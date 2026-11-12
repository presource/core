import { arrayWrapper } from '..';

/**
 * `is` contract (src/array/wrapper/methods/is.ts).
 *
 * Regression focus: the `invalid` case (is.ts:46) used `!valid`, negating the
 * sibling DISPATCHER FUNCTION that stringSwitch injects, so it was always false.
 * It is now `!valid()` — true when at least one element is null/undefined.
 */
describe('is check function for array Wrapper', () => {
    const $array = arrayWrapper();

    test('is array empty check', () => {
        expect($array([]).is('empty')).toBe(true);
        expect($array(['value']).is('empty')).toBe(false);
        // Falsy members still count as content
        expect($array([0]).is('empty')).toBe(false);
        expect($array([null, undefined]).is('empty')).toBe(false);
    });

    test('is array valid check', () => {
        // valid === count('invalid') === 0
        expect($array([]).is('valid')).toBe(true);
        expect($array([0, 1, 2, 3, 4, 'hello', false, true]).is('valid')).toBe(true);
        expect($array([1, 2, 3, 4, 'apple', null]).is('valid')).toBe(false);
        expect($array([1, null]).is('valid')).toBe(false);
        expect($array([undefined]).is('valid')).toBe(false);
    });

    test('is array invalid check is the exact inverse of valid', () => {
        // REGRESSION (is.ts:46): `!valid` negated a function reference => always false.
        expect($array([1, null]).is('invalid')).toBe(true);
        expect($array([1, 2]).is('invalid')).toBe(false);
        expect($array([null, undefined]).is('invalid')).toBe(true);
        expect($array([1, 2, 3, 'apple']).is('invalid')).toBe(false);
        // An empty array has no invalid member, so both valid and invalid are consistent
        expect($array([]).is('invalid')).toBe(false);
        expect($array([]).is('valid')).toBe(true);
        // 0 / '' / false are falsey but valid — they must not flip this to true
        expect($array([0, '', false]).is('invalid')).toBe(false);
    });

    test('is array filled check', () => {
        // filled === non-empty AND no `undefined` entries (null is allowed)
        expect($array([]).is('filled')).toBe(false);
        expect($array([0, 1, undefined]).is('filled')).toBe(false);
        expect($array(['apple', 0, null]).is('filled')).toBe(true);
        expect($array(['apple']).is('filled')).toBe(true);
        expect($array([null]).is('filled')).toBe(true);
        expect($array([undefined]).is('filled')).toBe(false);
    });

    test('unknown string keyword returns false', () => {
        expect($array([1, 2, 3]).is('unknown' as any)).toBe(false);
        expect($array([1, null]).is('bogus' as any)).toBe(false);
        // Empty string is not one of the four supported keywords
        expect($array([1, null]).is('' as any)).toBe(false);
        // Keyword lookup is case sensitive
        expect($array([1, null]).is('INVALID' as any)).toBe(false);
    });

    test('non-string request returns true (passthrough branch)', () => {
        // typeSwitch falls to `default: () => true` for any non-string request
        expect($array([1, 2, 3]).is(null as any)).toBe(true);
        expect($array([1, 2, 3]).is(undefined as any)).toBe(true);
        expect($array([1, 2, 3]).is(123 as any)).toBe(true);
        expect($array([1, 2, 3]).is(true as any)).toBe(true);
        expect($array([1, 2, 3]).is({} as any)).toBe(true);
        // Omitted request follows the same branch
        expect($array([1, 2, 3]).is()).toBe(true);
        // A non-string request ignores the array content entirely
        expect($array([]).is(null as any)).toBe(true);
    });

    test('sparse arrays are judged through their undefined reads', () => {
        // The early-exit scans read element[i], the same value `each` hands to
        // count(), so a hole counts as an undefined (and therefore invalid) entry.
        const holes = [1, , 3];
        expect($array(holes).is('empty')).toBe(false);
        expect($array(holes).is('valid')).toBe(false);
        expect($array(holes).is('invalid')).toBe(true);
        expect($array(holes).is('filled')).toBe(false);
        // A tail hole past the last index still breaks "filled"
        const tail: any[] = [1, 2];
        tail.length = 4;
        expect($array(tail).is('filled')).toBe(false);
        expect($array(tail).is('invalid')).toBe(true);
    });

    test('the filtered slow path keeps judging only the visible population', () => {
        // Trade-off T6: with a filter active `is` must still route through
        // `count()`/`each`, i.e. elements hidden by the filter are not judged.
        const visible = $array([1, 2, 3], { filter: [(data: any) => data.index === 1] });
        expect(visible.is('empty')).toBe(false);
        expect(visible.is('valid')).toBe(true);
        expect(visible.is('invalid')).toBe(false);
        expect(visible.is('filled')).toBe(true);

        // Indexes 2 (value 2) and 3 (value undefined) are the visible ones, so the
        // undefined at index 3 is what decides these answers.
        const nullish = $array([1, null, 2, undefined], { filter: [(data: any) => data.index > 1] });
        expect(nullish.is('invalid')).toBe(true);
        expect(nullish.is('valid')).toBe(false);
        expect(nullish.is('filled')).toBe(false);

        // The null at index 1 is hidden, so the array looks fully valid
        const hidden = $array([1, null], { filter: [(data: any) => data.index === 0] });
        expect(hidden.is('invalid')).toBe(false);
        expect(hidden.is('valid')).toBe(true);
        expect(hidden.is('filled')).toBe(true);

        // Inverted window: only the null is visible
        const onlyNull = $array([1, null], { filter: [(data: any) => data.index === 1] });
        expect(onlyNull.is('empty')).toBe(false);
        expect(onlyNull.is('invalid')).toBe(true);
        expect(onlyNull.is('valid')).toBe(false);
        // null is allowed by "filled", only `undefined` breaks it
        expect(onlyNull.is('filled')).toBe(true);

        // Nothing visible at all: the population is empty
        const nothing = $array([1, null], { filter: [() => false] });
        expect(nothing.is('empty')).toBe(true);
        expect(nothing.is('valid')).toBe(true);
        expect(nothing.is('invalid')).toBe(false);
        expect(nothing.is('filled')).toBe(false);
    });

    test('the unfiltered fast path stops at the first decisive element (L3)', () => {
        // An accessor element makes the read count observable. The pre-fix
        // implementation always walked the whole array via `count()`; the fast
        // path stops as soon as the answer is known, which is only observable
        // through side-effecting element getters.
        let reads = 0;
        const source: any[] = [1, 2, 3, 4, 5];
        Object.defineProperty(source, 2, {
            configurable: true,
            enumerable: true,
            get: () => {
                reads++;
                return null;
            }
        });
        const wrapper = $array(source);
        expect(wrapper.is('invalid')).toBe(true);
        // indexes 0 and 1 are read as plain values, index 2 decides the answer
        expect(reads).toBe(1);
        reads = 0;
        // "empty" is answered from `length` alone and never touches an element
        expect(wrapper.is('empty')).toBe(false);
        expect(reads).toBe(0);
        reads = 0;
        // With a filter active the slow `count()` path runs, which still reaches
        // the accessor exactly once while walking the population
        const filtered = $array(source, { filter: [(data: any) => data.index < 4] });
        expect(filtered.is('invalid')).toBe(true);
        expect(reads).toBe(1);
    });
});
