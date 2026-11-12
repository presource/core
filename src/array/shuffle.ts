/**
 * Array shuffling utilities.
 *
 * Provides functions to randomly reorder array elements using the
 * Fisher-Yates (Knuth) shuffle algorithm.
 */

/**
 * Signature for a shuffle function that returns a new shuffled array.
 *
 * @template T - The element type of the array.
 */
export type ArrayShuffle = <T>(original: T[]) => T[];

/**
 * Returns a new array with elements randomly shuffled using the Fisher-Yates algorithm.
 *
 * Does not mutate the original array.
 *
 * @template T - The element type of the array.
 * @param original - The array to shuffle.
 * @returns A new array with the same elements in random order.
 */
export const arrayShuffle: ArrayShuffle = (original) => {
  // Work on a shallow copy so the original array is not mutated
  const array = original.slice();
  let index = array.length;
  let random;
  // Fisher-Yates: iterate from the end, swapping each element with a random earlier element
  while (index !== 0) {
    random = Math.floor(Math.random() * index);
    index--;
    [array[index], array[random]] = [array[random], array[index]];
  }
  return array;
};
