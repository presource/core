/**
 * Array normalization utilities.
 *
 * Provides functions to ensure values are properly converted to arrays,
 * handling functions, undefined, and other types gracefully.
 */

import { typeSwitch } from '../type';

/**
 * Normalizes any value into an array.
 *
 * - If the value is a function, it invokes the function recursively.
 * - If undefined, returns an empty array.
 * - If already an array, returns it unchanged.
 * - Otherwise, wraps the value in a single-element array.
 *
 * @param unknown - The value to normalize. May be a function, array, or any other type.
 * @returns An array representation of the input value.
 */
export const arrayEnsures = (unknown?: any): any[] =>
    typeSwitch(unknown, {
        // If the value is a function, invoke it and recurse to resolve the returned value
        function: () => arrayEnsures(unknown()),
        // Undefined resolves to an empty array
        undefined: () => [],
        // Already an array — return as-is without wrapping
        array: () => unknown,
        // Any other type is wrapped in a single-element array
        default: () => [unknown]
    });
