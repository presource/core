/**
 * Array requeue utilities.
 *
 * Provides functions to rotate array elements, effectively implementing
 * a queue-like behavior by moving the head to the tail.
 */

/**
 * Rotates the array by moving the first element to the end.
 *
 * Mutates the array in place to preserve reference identity.
 *
 * @param array - The array to rotate.
 * @returns The same array reference, now rotated.
 */
export const arrayRequeue = (array: any[]): any[] => {
    // Only rotate if there is at least one element
    if (array.length > 0) {
        // Shift removes the first element; push appends it to the end
        array.push(array.shift());
    }
    return array;
};

