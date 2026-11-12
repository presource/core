import { arrayEnsures } from '@presource/core';

describe('Array Ensures: Ensuring a variable is an array', () => {
    test('all output from the method will returns an array', () => {
        // If nothing is passed, return array
        expect(arrayEnsures()).toStrictEqual([]);

        // Same as if nothing is passed in the beginning.
        expect(arrayEnsures(undefined)).toStrictEqual([]);

        expect(arrayEnsures(1)).toStrictEqual([1]);
        expect(arrayEnsures('a')).toStrictEqual(['a']);
        expect(arrayEnsures(null)).toStrictEqual([null]);
        expect(arrayEnsures([1, 2, 3])).toStrictEqual([1, 2, 3]);
        expect(arrayEnsures({ is: 'object' })).toStrictEqual([{ is: 'object' }]);

        // Special Cases Function
        expect(arrayEnsures(() => 'a')).toStrictEqual(['a']);
    });

    describe('Undefined / null', () => {
        test('Only `undefined` normalizes to an empty array', () => {
            expect(arrayEnsures()).toStrictEqual([]);
            expect(arrayEnsures(undefined)).toStrictEqual([]);
            expect(arrayEnsures().length).toBe(0);
        });

        test('`null` falls through to the default case and is wrapped', () => {
            // `null` has no constructor, so `typeSwitch` routes it to `default`, not to `undefined`.
            expect(arrayEnsures(null)).toStrictEqual([null]);
            expect(arrayEnsures(null).length).toBe(1);
        });
    });

    describe('Array input is aliased, not copied', () => {
        test('An existing array is returned by reference (same object)', () => {
            const source = [1, 2, 3];
            // Real contract: mutation through the result is visible on the input array.
            expect(arrayEnsures(source)).toBe(source);
        });

        test('Nested arrays are returned as-is and never flattened', () => {
            const nested = [[1, 2], [3]];
            expect(arrayEnsures(nested)).toBe(nested);
            expect(arrayEnsures(nested)).toStrictEqual([[1, 2], [3]]);
        });

        test('Empty and sparse arrays keep their exact shape and reference', () => {
            const empty: any[] = [];
            expect(arrayEnsures(empty)).toBe(empty);
            expect(arrayEnsures(empty)).toStrictEqual([]);

            const holes: any[] = [];
            holes[2] = 'tail';
            expect(arrayEnsures(holes)).toBe(holes);
            expect(arrayEnsures(holes).length).toBe(3);
            expect(arrayEnsures(holes)[0]).toBeUndefined();
        });

        test('Functions stored as array elements are not invoked', () => {
            const fn = () => 1;
            const list = [fn];
            const result = arrayEnsures(list);
            expect(result).toBe(list);
            expect(result[0]).toBe(fn);
        });
    });

    describe('Non-array values get wrapped in a single-element array', () => {
        test('Primitives are wrapped exactly', () => {
            expect(arrayEnsures(0)).toStrictEqual([0]);
            expect(arrayEnsures('')).toStrictEqual(['']);
            expect(arrayEnsures(false)).toStrictEqual([false]);
            expect(arrayEnsures(true)).toStrictEqual([true]);
            expect(arrayEnsures(NaN)[0]).toBeNaN();
            expect(arrayEnsures(NaN).length).toBe(1);
        });

        test('Objects and other host objects are wrapped while keeping element identity', () => {
            const object = { a: 1 };
            const wrappedObject = arrayEnsures(object);
            expect(Array.isArray(wrappedObject)).toBe(true);
            expect(wrappedObject.length).toBe(1);
            expect(wrappedObject[0]).toBe(object);

            const date = new Date(0);
            expect(arrayEnsures(date)).toStrictEqual([date]);
            expect(arrayEnsures(date)[0]).toBe(date);

            const symbol = Symbol('k');
            expect(arrayEnsures(symbol)).toStrictEqual([symbol]);
        });
    });

    describe('Function input is invoked and its result recursed', () => {
        test('The function is invoked exactly once and its return value is normalized', () => {
            const factory = vi.fn(() => 'a');
            expect(arrayEnsures(factory)).toStrictEqual(['a']);
            expect(factory.mock.calls).toStrictEqual([[]]);
        });

        test('A function returning a function recurses until a non-function value is reached', () => {
            expect(arrayEnsures(() => () => 5)).toStrictEqual([5]);
            expect(arrayEnsures(() => () => () => 'deep')).toStrictEqual(['deep']);
            expect(arrayEnsures(() => () => null)).toStrictEqual([null]);
        });

        test('A function returning `undefined` normalizes to an empty array', () => {
            expect(arrayEnsures(() => undefined)).toStrictEqual([]);
            expect(arrayEnsures(() => () => undefined)).toStrictEqual([]);
        });

        test('A function returning an array hands back that same reference', () => {
            const inner = [1, 2, 3];
            expect(arrayEnsures(() => inner)).toBe(inner);
            expect(arrayEnsures(() => [])).toStrictEqual([]);
        });

        test('A function returning a non-array value is wrapped once', () => {
            expect(arrayEnsures(() => ({ a: 1 }))).toStrictEqual([{ a: 1 }]);
            expect(arrayEnsures(() => 0)).toStrictEqual([0]);
        });

        test('G21: a function returning itself recurses until the stack overflows', () => {
            // ensures.ts:24 recurses through `arrayEnsures(unknown())` with no
            // depth or cycle guard, so a thunk that hands back itself never
            // terminates: the recursion dies in the engine stack limit.
            const self: any = () => self;
            expect(() => arrayEnsures(self)).toThrow(RangeError);
            expect(() => arrayEnsures(self)).toThrow('Maximum call stack size exceeded');
            // The same unbounded recursion happens for a thunk that reaches a
            // self-returning function one level deeper.
            expect(() => arrayEnsures(() => self)).toThrow(RangeError);
        });
    });
});
