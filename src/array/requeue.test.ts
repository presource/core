import { arrayRequeue } from '@presource/core';

describe('arrayRequeue Requirement', () => {
    test('Requeuing an array moves the first element to the last position', () => {
        const array = [1, 2, 3, 4, 5];
        arrayRequeue(array);
        expect(array).toStrictEqual([2, 3, 4, 5, 1]);
    });

    test('Requeuing keeps the same array reference', () => {
        const array = [1, 2, 3];
        const reference = array;
        arrayRequeue(array);
        expect(array).toBe(reference);
    });

    test('Requeuing an array with one element keeps it unchanged', () => {
        const array = [42];
        arrayRequeue(array);
        expect(array).toStrictEqual([42]);
    });

    test('Requeuing an empty array does nothing', () => {
        const array: any[] = [];
        arrayRequeue(array);
        expect(array).toStrictEqual([]);
    });

    test('Requeuing multiple times cycles through all elements', () => {
        const array = [1, 2, 3];
        arrayRequeue(array);
        expect(array).toStrictEqual([2, 3, 1]);
        arrayRequeue(array);
        expect(array).toStrictEqual([3, 1, 2]);
        arrayRequeue(array);
        expect(array).toStrictEqual([1, 2, 3]);
    });

    describe('In-place mutation contract', () => {
        test('The return value is the very same array instance that was passed in', () => {
            const array = ['a', 'b', 'c'];
            const result = arrayRequeue(array);

            // Rotation mutates in place AND hands the same reference back for chaining.
            expect(result).toBe(array);
            expect(result).toStrictEqual(['b', 'c', 'a']);
            expect(result.length).toBe(3);
        });

        test('Chaining the return value rotates repeatedly', () => {
            // [[1,2,3] -> [2,3,1]] -> [3,1,2]
            expect(arrayRequeue(arrayRequeue([1, 2, 3]))).toStrictEqual([3, 1, 2]);
        });

        test('A single element array keeps its reference and its only element', () => {
            const array = [42];
            const result = arrayRequeue(array);
            expect(result).toBe(array);
            expect(result).toStrictEqual([42]);
            expect(result.length).toBe(1);
        });

        test('An empty array is untouched: no `undefined` is appended by shift/push', () => {
            const array: any[] = [];
            const result = arrayRequeue(array);

            expect(result).toBe(array);
            expect(result).toStrictEqual([]);
            expect(result.length).toBe(0);
            // `array.push(array.shift())` is skipped entirely, so index 0 must not exist.
            expect(0 in array).toBe(false);
        });

        test('A full cycle of six calls returns the original order', () => {
            const array = [1, 2, 3, 4, 5, 6];
            const steps: any[][] = [];
            for (let call = 0; call < 6; call++) steps.push(arrayRequeue(array).slice());

            expect(steps).toStrictEqual([
                [2, 3, 4, 5, 6, 1],
                [3, 4, 5, 6, 1, 2],
                [4, 5, 6, 1, 2, 3],
                [5, 6, 1, 2, 3, 4],
                [6, 1, 2, 3, 4, 5],
                [1, 2, 3, 4, 5, 6],
            ]);
        });
    });

    describe('Elements are moved by reference', () => {
        test('Object elements keep their identity after rotation', () => {
            const first = { k: 1 };
            const second = { k: 2 };
            const array = [first, second];
            const result = arrayRequeue(array);

            expect(result).toBe(array);
            expect(result.map((item) => item.k)).toStrictEqual([2, 1]);
            expect(result[1]).toBe(first);
            expect(result[0]).toBe(second);
        });

        test('Nested array elements keep their identity after rotation', () => {
            const inner = [1];
            const array = [inner, [2]];
            const result = arrayRequeue(array);

            expect(result).toBe(array);
            expect(result[1]).toBe(inner);
            expect(result).toStrictEqual([[2], [1]]);
        });

        test('An `undefined` element is rotated like any other element', () => {
            const array = [undefined, 1];
            const result = arrayRequeue(array);

            expect(result).toStrictEqual([1, undefined]);
            expect(result.length).toBe(2);
            // The `undefined` came from the original slot, it is not a missing element.
            expect(0 in array).toBe(true);
            expect(1 in array).toBe(true);
        });

        test('Duplicate elements rotate positionally', () => {
            const array = [1, 1, 2];
            expect(arrayRequeue(array)).toStrictEqual([1, 2, 1]);
        });
    });
});
