import { arrayWrapper } from '..';

/**
 * `retain` contract (src/array/wrapper/methods/retain.ts).
 *
 * retain is the inverse of remove: it collects the indexes whose predicate is
 * falsey and hands them to a single `instance.remove()` call (retain.ts:37-41),
 * so the underlying array is spliced in place and only elements VISITED by
 * `each` can ever be dropped.
 */
describe('Filter function of array Wrapper', () => {
    const $array = arrayWrapper();
    const sample = ['apple', 'banana', 'cat', 'dog'];
    const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    test('predicate-false elements are removed from the source array in place', () => {
        const source = [...sample];
        // Block body callback: Array#push-style non-undefined returns would stop each()
        $array(source).retain(({ value }) => value !== 'banana');
        expect(source).toStrictEqual(['apple', 'cat', 'dog']);
    });

    test('the callback receives the exact iteration context for every element', () => {
        const seen: any[] = [];
        const source = [...twelve];
        $array(source).retain((data: any) => {
            seen.push({ index: data.index, value: data.value, length: data.length, result: data.result, callback: typeof data.callback });
            return data.index !== 10;
        });
        // One visit per element, in ascending index order, with the live array length
        expect(seen).toStrictEqual([
            { index: 0, value: 0, length: 12, result: undefined, callback: 'function' },
            { index: 1, value: 1, length: 12, result: undefined, callback: 'function' },
            { index: 2, value: 2, length: 12, result: undefined, callback: 'function' },
            { index: 3, value: 3, length: 12, result: undefined, callback: 'function' },
            { index: 4, value: 4, length: 12, result: undefined, callback: 'function' },
            { index: 5, value: 5, length: 12, result: undefined, callback: 'function' },
            { index: 6, value: 6, length: 12, result: undefined, callback: 'function' },
            { index: 7, value: 7, length: 12, result: undefined, callback: 'function' },
            { index: 8, value: 8, length: 12, result: undefined, callback: 'function' },
            { index: 9, value: 9, length: 12, result: undefined, callback: 'function' },
            { index: 10, value: 10, length: 12, result: undefined, callback: 'function' },
            { index: 11, value: 11, length: 12, result: undefined, callback: 'function' }
        ]);
        // Only the single rejected index (10) is spliced out
        expect(source).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11]);
    });

    test('retaining nothing empties the array', () => {
        const source = [...sample];
        $array(source).retain(() => false);
        expect(source).toStrictEqual([]);
        expect($array(source).count()).toBe(0);
        expect($array(source).is('empty')).toBe(true);
    });

    test('retaining everything leaves an unchanged copy', () => {
        const source = [...sample];
        $array(source).retain(() => true);
        expect(source).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect(source).not.toBe(sample);
        expect($array(source).get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
    });

    test('index based predicate keeps two-digit indexes correctly', () => {
        // Depends on the keys.ts:107 numeric sort: the collected indexes 0,2,4,6,8,10
        // must be spliced in ascending order for the offset math to stay correct
        const odds = [...twelve];
        $array(odds).retain(({ index }) => index % 2);
        expect(odds).toStrictEqual([1, 3, 5, 7, 9, 11]);

        const evens = [...twelve];
        $array(evens).retain(({ index }) => index % 2 === 0);
        expect(evens).toStrictEqual([0, 2, 4, 6, 8, 10]);
    });

    test('any falsey predicate result drops the element', () => {
        const zero = [...sample];
        // 0 is not `false` but is still falsey, so every element is dropped
        $array(zero).retain((data: any): any => (data.index === 0 ? 0 : ''));
        expect(zero).toStrictEqual([]);

        const nullish = ['apple', null, undefined, 'banana'];
        $array(nullish).retain(({ value }) => value !== null && value !== undefined);
        expect(nullish).toStrictEqual(['apple', 'banana']);
    });

    test('elements hidden by an active select filter are always retained', () => {
        // retain only records indexes visited through each(), so filtered-out
        // members never reach the removal list
        const source = [...sample];
        $array(source).select(0).retain(() => false);
        expect(source).toStrictEqual(['banana', 'cat', 'dog']);

        const partial = [...sample];
        $array(partial).select([1, 2]).retain(({ index }) => index !== 2);
        expect(partial).toStrictEqual(['apple', 'banana', 'dog']);
    });

    test('returns the wrapper instance for chaining', () => {
        const source = [...sample];
        const wrapper = $array(source);
        const returned = wrapper.retain(({ index }) => index !== 0);
        expect(returned).toBe(wrapper);
        expect(returned.get()).toStrictEqual(['banana', 'cat', 'dog']);
        expect(source).toStrictEqual(['banana', 'cat', 'dog']);
    });

    test('legacy sample keeps its documented behaviour', () => {
        const legacy = ['apple', 'banana', 'cat', 'dog', 1, 2, 3, 4, null, undefined, true, false];
        const source = [...legacy];
        $array(source).retain(({ value }: any) => value === 'apple');
        expect(source).toStrictEqual(['apple']);
    });
});
