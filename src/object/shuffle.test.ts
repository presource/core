import { objectShuffle } from '@presource/core';

/**
 * Stubs Math.random with an exact queue of values.
 *
 * arrayShuffle consumes exactly one random value per key (Fisher-Yates walks the index down
 * to zero), so the queue length must match the key count - a shorter queue yields `NaN`
 * swaps and a fixture that no longer describes real behaviour.
 */
const stubRandom = (values: number[]) => {
    let index = 0;
    return vi.spyOn(Math, 'random').mockImplementation(() => values[index++]);
};

describe('Object Shuffle', () => {
    afterEach(() => vi.restoreAllMocks());

    test('Array has been shuffled', () => {
        // Six keys with a fixed sequence: the resulting order is fully determined
        const spy = stubRandom([0.99, 0.5, 0.25, 0.1, 0.0, 0.0]);
        const original = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };

        const shuffled = objectShuffle(original);

        // The order is genuinely re-rolled, and one random value is drawn per key
        expect(Object.keys(shuffled)).toStrictEqual(['d', 'e', 'a', 'b', 'c', 'f']);
        expect(Object.keys(shuffled)).not.toStrictEqual(Object.keys(original));
        expect(spy.mock.calls).toHaveLength(6);
    });

    test('A fixed random sequence produces the exact key order', () => {
        stubRandom([0.99, 0.5, 0.25, 0.0]);
        const original = { a: 1, b: 2, c: 3, d: 4 };

        const shuffled = objectShuffle(original);

        // Key/value pairs as visited, in insertion order of the shuffled result
        expect(Object.keys(shuffled).map((key) => [key, shuffled[key]])).toStrictEqual([
            ['c', 3],
            ['a', 1],
            ['b', 2],
            ['d', 4]
        ]);
    });

    test('An all-zero sequence rotates every key left by one position', () => {
        stubRandom([0, 0, 0, 0, 0]);
        const shuffled = objectShuffle({ a: 1, b: 2, c: 3, d: 4, e: 5 });

        expect(Object.keys(shuffled)).toStrictEqual(['b', 'c', 'd', 'e', 'a']);
    });

    test('An all-max sequence keeps the original order', () => {
        stubRandom([0.99, 0.99, 0.99, 0.99]);
        const shuffled = objectShuffle({ a: 1, b: 2, c: 3, d: 4 });

        // floor(0.99 * index) always picks the element currently at `index`, so nothing swaps
        expect(Object.keys(shuffled)).toStrictEqual(['a', 'b', 'c', 'd']);
    });

    test('Returns a new object with the same entries without touching the source', () => {
        stubRandom([0.99, 0.99, 0.99, 0.99]);
        const nested = { deep: 1 };
        const original = { a: nested, b: 2, c: 3, d: 4 };

        const shuffled = objectShuffle(original);

        // A brand new container holding the same (still shared) values
        expect(shuffled).not.toBe(original);
        expect(shuffled).toStrictEqual({ a: { deep: 1 }, b: 2, c: 3, d: 4 });
        expect(shuffled.a).toBe(nested);
        // The source keeps its own key order and contents
        expect(Object.keys(original)).toStrictEqual(['a', 'b', 'c', 'd']);
        expect(original).toStrictEqual({ a: nested, b: 2, c: 3, d: 4 });
        // Same key set, just re-ordered
        expect(Object.keys(shuffled).slice().sort()).toStrictEqual(['a', 'b', 'c', 'd']);
    });

    test('An empty object is returned empty and consumes no randomness', () => {
        const spy = stubRandom([]);

        const shuffled = objectShuffle({});

        expect(shuffled).toStrictEqual({});
        expect(spy.mock.calls).toHaveLength(0);
    });

    test('A single key object consumes exactly one random value', () => {
        const spy = stubRandom([0.42]);

        const shuffled = objectShuffle({ only: 1 });

        expect(shuffled).toStrictEqual({ only: 1 });
        expect(spy.mock.calls).toHaveLength(1);
    });

    test('Only own keys are shuffled; inherited keys are dropped', () => {
        stubRandom([0.99]);
        function Holder(this: any) {
            this.own = 1;
        }
        (Holder as any).prototype.inherited = 'proto';
        const instance: any = new (Holder as any)();

        const shuffled = objectShuffle(instance);

        // Object.keys is own-only, so the prototype value never reaches the result
        expect(shuffled).toStrictEqual({ own: 1 });
        expect(Object.keys(shuffled)).toStrictEqual(['own']);
        expect(shuffled.inherited).toBeUndefined(); // the result is a fresh plain object
        expect('inherited' in shuffled).toBe(false);
    });
});
