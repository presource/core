/**
 * String reversal utility.
 *
 * Reverses a string by splitting it into an array of characters,
 * reversing the array, and joining back together.
 */

/**
 * Reverse the characters in a string.
 *
 * @param value - The string to reverse.
 * @returns The reversed string.
 */
export const stringReverse = (value: string) => value.split('').reverse().join('');
