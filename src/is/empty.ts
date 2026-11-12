/**
 * Emptiness-checking utilities.
 *
 * Provides helpers for determining whether a value is "empty" based on
 * its type: numbers are empty when NaN, strings when blank (after trim),
 * arrays when all nested elements are empty, and objects when all
 * nested property values are empty.
 */
import { typeSwitch } from '../type';
import { arrayEach } from '../array';
import { objectEach } from '../object';


/**
 * Checks whether a value is empty based on its type.
 *
 * Uses a type-switch to apply different emptiness criteria per type:
 * - **number**: empty when `NaN`
 * - **string**: empty when whitespace-trimmed result is `''`
 * - **array**: empty when every element is itself empty (recursive)
 * - **object**: empty when every property value is itself empty (recursive)
 * - **default**: truthy/falsy evaluation of the raw value
 *
 * @param input - The value to test.
 * @returns `true` if the value is considered empty; `false` otherwise.
 */
export const isEmpty = (input: any) =>
  typeSwitch(input, {
    // NaN is treated as an empty number
    number: () => isNaN(input),
    // A string is empty if it contains only whitespace
    string: () => input.trim() === '',
    // An array is empty only if every element is empty (recursive check)
    array: () => isEmptyArray(input),
    // An object is empty only if every property value is empty (recursive check)
    object: () => isEmptyObject(input),
    // For any other type, the raw truthiness decides: truthy values are considered empty
    default: () => !!input,
  });

/**
 * Checks whether an array is empty by recursing into each element.
 *
 * An array is considered empty if every element, when passed to
 * {@link isEmpty}, returns `true`. Short-circuits on the first
 * non-empty element encountered.
 *
 * @param unknown - The array to test.
 * @returns `true` if every element is empty; `false` otherwise.
 */
export const isEmptyArray = <T>(unknown: any): unknown is T[] => {
  // Assume the array is empty until proven otherwise
  let result = true;
  // Iterate over each element; stop early if a non-empty value is found
  arrayEach(unknown, ({ value }) => {
    // If any element is non-empty, mark the array as non-empty
    if (!isEmpty(value)) return (result = false);
  });
  return result;
};

/**
 * Checks whether an object is empty by recursing into each property value.
 *
 * An object is considered empty if every property value, when passed to
 * {@link isEmpty}, returns `true`. Short-circuits on the first
 * non-empty value encountered.
 *
 * @param unknown - The object to test.
 * @returns `true` if every property value is empty; `false` otherwise.
 */
export const isEmptyObject = (unknown: any): unknown is {} => {
  // Assume the object is empty until proven otherwise
  let result = true;

  // Iterate over each property; stop early if a non-empty value is found
  objectEach(unknown, ({ value }) => {
    // If any property value is non-empty, mark the object as non-empty
    if (!isEmpty(value)) return (result = false);
  });
  return result;
};
