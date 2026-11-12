import { arrayWrapper } from '..';

/**
 * `select` contract (src/array/wrapper/methods/select.ts).
 *
 * `select` appends a predicate to `config.filter` and returns a NEW wrapper over
 * the SAME element array (select.ts:53-76). Only `number` and `array` requests
 * filter; every other request type hits typeSwitch `default: () => true`
 * (select.ts:71) — the documented current limitation, pinned exactly below.
 */
describe('Array Wrapper Select Function', () => {
    const $array = arrayWrapper();
    const sample = ['apple', 'banana', 'cat', 'dog'];

    test('number request filters to that single index', () => {
        expect($array(sample).select(0).get()).toStrictEqual(['apple']);
        expect($array(sample).select(3).get()).toStrictEqual(['dog']);
        // Index outside the array matches nothing
        expect($array(sample).select(99).get()).toStrictEqual([]);
        expect($array(sample).select(0).keys()).toStrictEqual([0]);
        expect($array(sample).select(99).count()).toBe(0);
    });

    test('array request unions its numeric sub-criteria', () => {
        expect($array(sample).select([0, 2]).get()).toStrictEqual(['apple', 'cat']);
        // Result order comes from keys() ascending sort, not from the criteria order
        expect($array(sample).select([2, 0]).get()).toStrictEqual(['apple', 'cat']);
        // Repeated sub-criteria collapse
        expect($array(sample).select([0, 0, 2]).get()).toStrictEqual(['apple', 'cat']);
        expect($array(sample).select([0, 2]).keys()).toStrictEqual([0, 2]);
        expect($array(sample).select([0, 2]).count()).toBe(2);
        // Ten-plus elements keep ascending order (depends on the keys.ts:107 numeric comparator)
        const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        expect($array(twelve).select([0, 10, 11]).get()).toStrictEqual([0, 10, 11]);
    });

    test('string, boolean and nullish requests apply no filtering', () => {
        // select.ts:55 typeSwitch has no string/boolean/null case => default accepts everything
        expect($array(sample).select('all').get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect($array(sample).select('all').keys()).toStrictEqual([0, 1, 2, 3]);
        expect($array(sample).select(true).get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect($array(sample).select(false).get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect($array(sample).select(null).get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect($array(sample).select(undefined).get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
    });

    test('callback request applies no filtering (current limitation)', () => {
        // A function request is not handled: even `() => false` keeps every element
        expect($array([1, 2, 3]).select(() => false).get()).toStrictEqual([1, 2, 3]);
        expect($array(sample).select(() => true).count()).toBe(4);
        expect($array(sample).select(() => false).keys()).toStrictEqual([0, 1, 2, 3]);
    });

    test('array request with string or boolean sub-criteria throws when read', () => {
        // The array branch reuses the sibling `string`/`boolean` handlers from the outer
        // typeSwitch, which only declares `number`/`array`/`default` (select.ts:59-65),
        // so a string/boolean criterion calls an undefined helper => TypeError.
        // The message is name-mangled by the transform, so only the error type is pinned.
        expect(() => $array(sample).select(['apple']).get()).toThrow(TypeError);
        expect(() => $array(sample).select([true, false]).get()).toThrow(TypeError);
        // The number criterion is evaluated first, so even a mixed list throws
        expect(() => $array(sample).select([0, 'apple']).get()).toThrow(TypeError);
        // Filtering is lazy: nothing throws until a predicate runs, and an empty
        // array iterates nothing, so the invalid criteria are never reached
        expect($array([]).select(['apple']).get()).toStrictEqual([]);
        // An empty criteria array matches nothing, so every element is filtered out
        expect($array(sample).select([]).get()).toStrictEqual([]);
    });

    test('chained selects compose as AND', () => {
        // Index 0 must satisfy both predicates; index 2 only satisfies the second
        expect($array(sample).select(0).select(2).get()).toStrictEqual([]);
        expect($array(sample).select(0).select(0).get()).toStrictEqual(['apple']);
        expect($array(sample).select([0, 2]).select([1, 2]).get()).toStrictEqual(['cat']);
        expect($array(sample).select([0, 2]).select([1, 2]).keys()).toStrictEqual([2]);
        // Chaining a non-filtering request onto a filtered one keeps the filter intact
        expect($array(sample).select(1).select('all').get()).toStrictEqual(['banana']);
    });

    test('a derived wrapper does not corrupt the parent wrapper', () => {
        const parent = $array(sample);
        const derived = parent.select(1);
        // The root config has no `filter` key, so select() builds a fresh array (select.ts:53)
        expect(derived.get()).toStrictEqual(['banana']);
        expect(parent.get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect(parent.keys()).toStrictEqual([0, 1, 2, 3]);
        // The derived wrapper shares the same element reference and is a distinct instance
        expect(derived.keys()).toStrictEqual([1]);
    });

    test('a parent that already carries a filter array is shared with its children', () => {
        // select.ts:53 reuses (does not clone) `config.filter`, so a child select()
        // pushes into the parent's array and narrows the parent as well.
        const parent = $array(sample).select(0);
        expect(parent.get()).toStrictEqual(['apple']);
        const child = parent.select(2);
        expect(child.get()).toStrictEqual([]);
        expect(parent.get()).toStrictEqual([]);
        expect(parent.keys()).toStrictEqual([]);

        // Same aliasing applies to a caller-supplied config array
        const filters: ((data: any) => boolean)[] = [(data: any) => data.index < 3];
        const seeded = $array(sample, { filter: filters });
        expect(seeded.keys()).toStrictEqual([0, 1, 2]);
        seeded.select(0);
        expect(seeded.keys()).toStrictEqual([0]);
        expect(filters).toHaveLength(2);
    });

    test('select feeds each, keys and remove without mutating the source', () => {
        const source = [...sample];
        const visited: string[] = [];
        // Block body matters: an arrow returning Array#push() short-circuits arrayEach
        $array(source)
            .select([0, 2])
            .each((data) => {
                visited.push(data.value);
            });
        expect(visited).toStrictEqual(['apple', 'cat']);

        $array(source).select(0).remove();
        // select never mutates; remove() on the derived wrapper splices the shared array
        expect(source).toStrictEqual(['banana', 'cat', 'dog']);
    });

    test('removal through a filtered wrapper respects the active filter', () => {
        const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
        const source = [...twelve];
        $array(source).select([0, 11]).remove();
        expect(source).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});
