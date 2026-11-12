/**
 * Object shuffle utility.
 *
 * Returns a new object with the same key-value pairs but in a randomised
 * key insertion order (shuffled keys).
 */
import { arrayShuffle } from '../array';

/**
 * Returns a new object whose properties are in a random (shuffled) order.
 *
 * Extracts the keys, shuffles them, then reconstructs the object.
 *
 * @param object - The object to shuffle.
 * @returns A new object with the same entries but keys in random order.
 */
export const objectShuffle = (object: { [key: string]: any }): { [key: string]: any } => {
  // Get the Keys Information
  const keys = Object.keys(object);

  const result: any = {};
  // `arrayShuffle` already slices internally, and the return value of the shuffle is the
  // only array needed here, so the previous discarded `.map()` allocation is dropped and
  // the side-effecting walk uses forEach.
  arrayShuffle(keys).forEach((key) => {
    // Assign each key-value in the shuffled order
    result[key] = object[key];
  });

  // Returning the Result
  return result;
};
