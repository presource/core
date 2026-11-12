import { arrayShuffle } from '@presource/core';

describe('Testing array shuffling', () => {
    // Every randomized assertion below pins `Math.random` to a fixed sequence, so the
    // Fisher-Yates output is fully deterministic and can be asserted with exact values.
    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Stubs `Math.random` with a repeating sequence and reports how often it was consumed. */
    const stubRandom = (sequence: number[]) => {
        let cursor = 0;
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => sequence[cursor++ % sequence.length]);
        return spy;
    };

    test('Array has been shuffled', () => {
        const original = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        stubRandom([0.5, 0]);

        const shuffled = arrayShuffle(original);

        // The Order should not be the same anymore
        expect(shuffled).not.toStrictEqual(original);
        // ...and the exact order under this deterministic sequence is known.
        expect(shuffled).toStrictEqual([9, 7, 2, 6, 3, 8, 4, 1, 5]);
    });

    test('The original array is never mutated and a new array is returned', () => {
        const original = [1, 2, 3, 4, 5];
        const before = original.slice();
        stubRandom([0.5, 0]);

        const shuffled = arrayShuffle(original);

        expect(original).toStrictEqual(before);
        expect(shuffled).not.toBe(original);
        // Exact order under the stubbed sequence (swaps verified against the runtime).
        expect(shuffled).toStrictEqual([5, 4, 2, 1, 3]);
        expect(shuffled[0]).toBe(5);
    });

    test('The exact multiset of elements is preserved', () => {
        const original = [5, 3, 9, 1, 7, 2, 8, 4, 6, 10, 11, 12];
        // Real randomness here; the sorted result is a deterministic invariant.
        const shuffled = arrayShuffle(original);
        expect(shuffled.slice().sort((a, b) => a - b)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(shuffled.length).toBe(12);
    });

    test('Empty arrays shuffle to an empty array (new reference)', () => {
        const original: number[] = [];
        expect(arrayShuffle(original)).toStrictEqual([]);
        expect(arrayShuffle(original)).not.toBe(original);
    });

    test('Single element arrays are returned unchanged but as a new array', () => {
        const original = [42];
        stubRandom([0.7]);

        const shuffled = arrayShuffle(original);

        expect(shuffled).toStrictEqual([42]);
        expect(shuffled).not.toBe(original);
        expect(original).toStrictEqual([42]);
    });

    describe('Deterministic Fisher-Yates output', () => {
        const twenty = Array.from({ length: 20 }, (_, index) => index);

        test('Randomness of 0 rotates the tail elements to the front one by one', () => {
            stubRandom([0]);
            expect(arrayShuffle(twenty)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 0]);
        });

        test('Randomness just below 1 keeps the order untouched (every swap hits itself)', () => {
            stubRandom([0.999999]);
            expect(arrayShuffle(twenty)).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
        });

        test('A repeating four-value sequence produces this exact order', () => {
            const spy = stubRandom([0, 0.5, 0.25, 0.75]);

            expect(arrayShuffle(twenty)).toStrictEqual([16, 17, 10, 14, 8, 1, 13, 11, 6, 2, 5, 15, 18, 3, 7, 19, 12, 4, 9, 0]);

            // One `Math.random()` call per element, always with no arguments.
            expect(spy.mock.calls).toStrictEqual(new Array(20).fill([]));
        });

        test('A small array with a two-value sequence', () => {
            stubRandom([0.5, 0]);
            expect(arrayShuffle([1, 2, 3, 4])).toStrictEqual([4, 2, 1, 3]);
        });

        test('Object elements are moved by reference, not copied', () => {
            const a = { id: 'a' };
            const b = { id: 'b' };
            const c = { id: 'c' };
            stubRandom([0.5, 0.1]);

            const shuffled = arrayShuffle([a, b, c]);

            expect(shuffled.map((item) => item.id)).toStrictEqual(['c', 'a', 'b']);
            expect(shuffled[0]).toBe(c);
            expect(shuffled[1]).toBe(a);
            expect(shuffled[2]).toBe(b);
        });
    });
});
