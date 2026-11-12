/**
 * Object ensures utility.
 *
 * Guarantees that the given value is represented as a plain object,
 * converting arrays, functions, primitives, and undefined values
 * into object form.
 */

import { toString } from '../to';
import { typeSwitch } from '../type';

/**
 * Coerces any value into a plain object.
 *
 * Conversion rules:
 * - **function**: Invoked recursively; the return value is coerced.
 * - **object**: Returned as-is.
 * - **array**: Converted to an object with numeric string keys (`"0"`, `"1"`, ...).
 * - **undefined**: Returns `{}`.
 * - **other primitives**: Wrapped as `{ [toString(value)]: value }`.
 *
 * @param unknown - The value to coerce. Defaults to `undefined`.
 * @returns A plain object representation of the input.
 */
export const objectEnsures = (unknown?: any): { [key: string]: any } =>
  // Looping through typeSwitch format
  typeSwitch(unknown, {
    // If Function is Passed
    function: () => objectEnsures(unknown()),
    // If it is Object. it will return the object as it is
    object: () => unknown,
    // If it is an array, it will reassigned key and value
    array: () => {
      const result: any = {};
      unknown.forEach((value: any, index: any) => {
        // Reorganised array into object
        result[index] = value;
      });
      // Returning the Result
      return result;
    },
    // If Undefined. it will return empty object
    undefined: () => ({}),
    // For Everything Else. Wrap the value as { [stringified]: value }
    default: () => ({
      // Converting Unknown to String
      [toString(unknown)]: unknown,
    }),
  });
