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
 * The buckets below are resolved by `typeSwitch`, i.e. by the value's constructor
 * name - only a literal `{}` reaches the "object" bucket:
 * - **function**: Invoked recursively; the return value is coerced.
 * - **plain object**: Returned as-is (same reference, no clone).
 * - **array**: Converted to an object with numeric string keys (`"0"`, `"1"`, ...).
 * - **undefined**: Returns `{}`.
 * - **everything else** (primitives, `null`, class instances, built-ins, prototype-less
 *   objects): Wrapped as `{ [toString(value)]: value }`. A prototype-less object has no
 *   constructor, so `typeSwitch` routes it to the "null" bucket and `toString` hands back
 *   the `"null"` sentinel - the result is keyed `"null"`.
 *
 * @param unknown - The value to coerce. Defaults to `undefined`.
 * @returns A plain object representation of the input.
 */
export const objectEnsures = (unknown?: any): { [key: string]: any } =>
  // Dispatch on the runtime type of `unknown`; each branch below is one conversion rule
  typeSwitch(unknown, {
    // If Function is Passed, invoke it and coerce whatever it returns
    function: () => objectEnsures(unknown()),
    // If it is an Object, it is returned as it is
    object: () => unknown,
    // If it is an Array, re-index its entries onto object keys
    array: () => {
      const result: any = {};
      unknown.forEach((value: any, index: any) => {
        // Array index becomes the object key
        result[index] = value;
      });
      return result;
    },
    // If Undefined, return an empty object
    undefined: () => ({}),
    // For Everything Else, wrap the value as { [stringified]: value }
    default: () => ({
      // The stringified value doubles as the key
      [toString(unknown)]: unknown,
    }),
  });
