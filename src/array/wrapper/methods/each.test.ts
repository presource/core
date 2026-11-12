import { arrayWrapper } from '..';

/**
 * `each` contract (src/array/wrapper/methods/each.ts).
 *
 * each delegates to `arrayEach` (each.ts:53), so the callback receives the full
 * iteration context object (`{ index, value, length, callback, result }`), the
 * iteration stops on the first NON-UNDEFINED callback return, and the method
 * itself always returns the wrapper instance for chaining (each.ts:59).
 */
describe('Each function of array Wrapper', () => {
    const $array = arrayWrapper();
    const sample = ['apple', 'banana', 'cat'];
    const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    test('callback receives the exact iteration context per element', () => {
        const seen: any[] = [];
        $array(sample).each((data: any) => {
            // Block body: a non-undefined return would short-circuit the loop
            seen.push({ index: data.index, value: data.value, length: data.length, result: data.result });
        });
        expect(seen).toStrictEqual([
            { index: 0, value: 'apple', length: 3, result: undefined },
            { index: 1, value: 'banana', length: 3, result: undefined },
            { index: 2, value: 'cat', length: 3, result: undefined }
        ]);

        // Index/value pairs for a 12 element fixture, ascending
        const pairs: [number, number][] = [];
        $array(twelve).each((data: any) => {
            pairs.push([data.index, data.value]);
        });
        expect(pairs).toStrictEqual([
            [0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5],
            [6, 6], [7, 7], [8, 8], [9, 9], [10, 10], [11, 11]
        ]);
    });

    test('the context object is a single shared, mutable instance', () => {
        const references: any[] = [];
        $array(sample).each((data: any) => {
            references.push(data);
        });
        // arrayEach builds the params object once (arrayEach.ts:55-63) and reuses it
        expect(references.length).toBe(3);
        expect(references[0]).toBe(references[1]);
        expect(references[1]).toBe(references[2]);
    });

    test('only elements passing the active select filter are visited', () => {
        const visited: string[] = [];
        $array(sample)
            .select([0, 2])
            .each((data) => {
                visited.push(data.value);
            });
        expect(visited).toStrictEqual(['apple', 'cat']);

        // A numeric request narrows the visit to a single index
        const single: string[] = [];
        $array(sample)
            .select(1)
            .each((data) => {
                single.push(data.value);
            });
        expect(single).toStrictEqual(['banana']);
    });

    test('a non-undefined callback return short-circuits the iteration', () => {
        const visited: string[] = [];
        $array(sample).each((data) => {
            visited.push(data.value);
            if (data.value === 'banana') return 'stop';
        });
        // The short-circuiting element is still visited; the next one is skipped
        expect(visited).toStrictEqual(['apple', 'banana']);

        // `false` is non-undefined, so it also stops the loop
        const stops: string[] = [];
        $array(sample).each((data) => {
            stops.push(data.value);
            if (data.index === 1) return false;
        });
        expect(stops).toStrictEqual(['apple', 'banana']);

        // Returning undefined keeps iterating to the end
        const full: string[] = [];
        $array(sample).each((data) => {
            full.push(data.value);
        });
        expect(full).toStrictEqual(['apple', 'banana', 'cat']);
    });

    test('returns the wrapper instance for chaining', () => {
        const wrapper = $array(sample);
        const returned = wrapper.each(() => undefined);
        expect(returned).toBe(wrapper);
        // The returned value is a working wrapper, not the raw array
        expect(returned.get()).toStrictEqual(['apple', 'banana', 'cat']);
        expect(returned.count()).toBe(3);
        expect(returned.keys()).toStrictEqual([0, 1, 2]);
        // A filtered wrapper returns its own derived instance, not the root
        const derived = $array(sample).select(0);
        expect(derived.each(() => undefined)).toBe(derived);
        expect(derived.each(() => undefined).get()).toStrictEqual(['apple']);
    });

    test('empty array visits nothing', () => {
        const visited: any[] = [];
        const wrapper = $array([]);
        const returned = wrapper.each((data) => {
            visited.push(data.value);
        });
        expect(visited).toStrictEqual([]);
        expect(returned).toBe(wrapper);
        expect(returned.count()).toBe(0);
        // A filter that rejects everything also visits nothing
        const filtered: any[] = [];
        $array(sample)
            .select(99)
            .each((data) => {
                filtered.push(data.value);
            });
        expect(filtered).toStrictEqual([]);
    });

    test('each reads the live array after an in-place remove', () => {
        const source = [...sample];
        const visited: string[] = [];
        $array(source).remove(0);
        $array(source).each((data) => {
            visited.push(data.value);
        });
        expect(visited).toStrictEqual(['banana', 'cat']);
    });
});
