import { arrayCreate } from '@presource/core';

describe('arrayCreate Requirement', () => {
  test('Creating an array with various inputs', () => {
    // Create a New Array
    expect(arrayCreate()).toStrictEqual([]);

    // Creating an Array with Length of 5
    expect(arrayCreate(5).length).toBe(5);

    // When Accepting Function
    const array = arrayCreate(({ index }) => {
      if (index < 5) return index;
    });
    expect(array.length).toBe(5);
    expect(array).toStrictEqual([0, 1, 2, 3, 4]);
  });

  describe('Number mode', () => {
    test('Zero produces an empty array', () => {
      expect(arrayCreate(0)).toStrictEqual([]);
      expect(arrayCreate(0).length).toBe(0);
    });

    test('Positive integers produce dense arrays of undefined', () => {
      // Every element is asserted explicitly (not just `.length`), and the array
      // must be dense (`0 in array`) rather than a sparse hole-filled array.
      expect(arrayCreate(1)).toStrictEqual([undefined]);
      expect(arrayCreate(5)).toStrictEqual([undefined, undefined, undefined, undefined, undefined]);
      expect(0 in arrayCreate(1)).toBe(true);
      expect(4 in arrayCreate(5)).toBe(true);
      expect(arrayCreate(3).every((value) => value === undefined)).toBe(true);
    });

    test('Fractional lengths are floored (clamp regression for the old `while (value--)` loop)', () => {
      // The old implementation decremented by 1 forever for fractional input,
      // growing the array until `RangeError: Invalid array length` was thrown.
      expect(arrayCreate(2.7)).toStrictEqual([undefined, undefined]);
      expect(arrayCreate(1.2)).toStrictEqual([undefined]);
      expect(arrayCreate(5.999)).toStrictEqual([undefined, undefined, undefined, undefined, undefined]);
      // Below one whole element, so nothing is generated at all.
      expect(arrayCreate(0.999)).toStrictEqual([]);
    });

    test('Negative, negative-fractional, negative-infinite and NaN lengths produce an empty array', () => {
      // Every negative number is truthy, so `while (value--)` used to spin forever here too.
      expect(arrayCreate(-3)).toStrictEqual([]);
      expect(arrayCreate(-0.5)).toStrictEqual([]);
      expect(arrayCreate(-Infinity)).toStrictEqual([]);
      expect(arrayCreate(NaN)).toStrictEqual([]);
      expect(arrayCreate(-0)).toStrictEqual([]);
    });

    test('Non-number, non-function inputs produce an empty array (never throws)', () => {
      // These hit `typeSwitch` branches that `arrayCreate` does not declare, so the
      // shared `result` array is simply returned untouched.
      expect(arrayCreate('4' as never)).toStrictEqual([]);
      expect(arrayCreate(null as never)).toStrictEqual([]);
      expect(arrayCreate(true as never)).toStrictEqual([]);
      expect(arrayCreate({} as never)).toStrictEqual([]);
      expect(arrayCreate([] as never)).toStrictEqual([]);
      expect(arrayCreate(new Date(0) as never)).toStrictEqual([]);
      expect(arrayCreate(Symbol('x') as never)).toStrictEqual([]);
    });
  });

  describe('Factory mode', () => {
    test('Returning undefined on the very first call produces an empty array', () => {
      expect(arrayCreate(() => undefined)).toStrictEqual([]);
    });

    test('Falsy-but-defined returns keep the generation going (only exact undefined stops)', () => {
      // The loop guard is `item === undefined`, so `0`, `''`, `false` and `null`
      // are all collected as real elements.
      const values: unknown[] = [0, '', false, null, 0];
      let invocations = 0;
      const result = arrayCreate(() => {
        // Count every invocation, including the one that ends the generation.
        const current = invocations;
        invocations++;
        if (current >= values.length) return undefined;
        return values[current];
      });
      expect(result).toStrictEqual([0, '', false, null, 0]);
      // The terminating call is counted too, hence 6 invocations for 5 elements.
      expect(invocations).toBe(6);

      // `null` is a collectable element as well.
      let nullCalls = 0;
      expect(
        arrayCreate(() => (nullCalls++ < 2 ? null : undefined))
      ).toStrictEqual([null, null]);
      expect(nullCalls).toBe(3);
    });

    test('Callback receives the full documented Arguments object: { index, value, result }', () => {
      const seen: Array<{ keys: string[]; index: number; value: unknown; result: unknown[] }> = [];

      const result = arrayCreate((args) => {
        const { index, value, result: accumulated } = args;
        // `result` is the LIVE array, so it has to be snapshotted here; recording the
        // reference would make every entry show the final state after the loop ends.
        seen.push({ keys: Object.keys(args), index, value, result: accumulated.slice() });
        if (index > 2) return undefined;
        return index * 10;
      });

      // Exactly the three documented keys, in declaration order, on every call.
      const documentedKeys = ['index', 'value', 'result'];

      // `value` is the previously produced element (`undefined` on the first call);
      // the call that returns `undefined` (index 3) still receives the state.
      expect(seen).toStrictEqual([
        { keys: documentedKeys, index: 0, value: undefined, result: [] },
        { keys: documentedKeys, index: 1, value: 0, result: [0] },
        { keys: documentedKeys, index: 2, value: 10, result: [0, 10] },
        { keys: documentedKeys, index: 3, value: 20, result: [0, 10, 20] },
      ]);
      expect(result).toStrictEqual([0, 10, 20]);
    });

    test('`result` is the live accumulated array, so mutations are visible on the next call', () => {
      let secondCallSnapshot: unknown[] = [];

      arrayCreate(({ index, result }) => {
        if (index === 0) {
          result.push('injected');
          return 'a';
        }
        secondCallSnapshot = result.slice();
        return undefined;
      });

      // The pushed 'injected' item survives, and the returned 'a' was appended after it.
      expect(secondCallSnapshot).toStrictEqual(['injected', 'a']);
    });

    test('Factory errors propagate to the caller', () => {
      expect(() =>
        arrayCreate(() => {
          throw new Error('boom');
        })
      ).toThrow('boom');

      // Throwing after producing elements must also surface the error untouched.
      expect(() =>
        arrayCreate(({ index }) => {
          if (index === 0) return 'a';
          throw new Error('second');
        })
      ).toThrow('second');
    });
  });
});
