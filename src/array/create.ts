/**
 * Array creation utilities.
 *
 * Provides a function to generate arrays either by size or by a
 * callback factory that produces elements until it returns undefined.
 */

import { typeSwitch } from '../type';

/**
 * Argument object passed to the create callback.
 */
type Arguments = {
  /** The current index being generated. */
  index: number;
  /** The value produced by the previous callback invocation. */
  value: any;
  /** The accumulated result array so far. */
  result: any;
};

/**
 * Callback invoked for each element generation step.
 * Return `undefined` to signal the end of generation.
 */
type Callback = (args: Arguments) => any;

/**
 * Signature for the array creation function.
 * Accepts either a number (array length) or a callback (element factory).
 */
export type ArrayCreate = (input?: number | Callback) => any[];

/**
 * Creates a new array.
 *
 * - If given a number, returns an array of that length filled with `undefined`.
 * - If given a callback, repeatedly invokes it with an incrementing index
 *   until the callback returns `undefined`.
 * - If given nothing, returns an empty array.
 *
 * @param argument - Either a desired length (number) or a factory callback.
 * @returns The newly created array.
 */
export const arrayCreate: ArrayCreate = (argument) => {
  const result: any[] = [];

  typeSwitch(argument, {
    // Callback mode: generate elements until the callback returns undefined
    function: ({ value }) => {
      let index = 0;
      // IMPORTANT: the callback MUST eventually return undefined to avoid an infinite loop
      while (1) {
        // `value` is the previously produced item (undefined on the first pass)
        // and `result` is the live accumulated array — both are part of the
        // documented `Arguments` contract, so they are passed here.
        const item = value({ index, value: result[index - 1], result });
        if (item === undefined) break;
        result.push(item);
        index++;
      }
    },
    // Number mode: create a fixed-length array filled with undefined
    number: ({ value }) => {
      // Defensive normalization: `while (value--)` never terminates for
      // fractional/negative input (every negative number is truthy), which
      // grew the array until the engine threw `RangeError: Invalid array
      // length`. Clamp to a non-negative integer so an invalid length simply
      // produces a shorter/empty array, matching this function's "never
      // throws" behaviour for every other input type.
      const length = value > 0 ? Math.floor(value) : 0;
      for (let index = 0; index < length; index++) result.push(undefined);
    },
  });

  return result;
};
