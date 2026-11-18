/**
 * boolean/cases
 *
 * Core iteration utility for boolean case evaluation. Walks over each key in
 * a cases object, evaluates its value (supporting nested objects, functions,
 * and raw values), runs an optional callback, and returns an accumulated
 * result object.
 */

import { typeSwitch } from '../type';
import { objectEach } from '../object';


/** An object mapping string keys to arbitrary values (conditions). */
type Cases = { [key: string]: any };

/** Argument object passed to the callback for each evaluated case: `value` is the evaluated case and `result` is the LIVE accumulator (both declared loosely). */
type Argument<T> = { key: string; value: boolean; result: keyof T };

/** Callback signature invoked for each evaluated case. */
type Callback<T> = (arg: Argument<T>) => any;

/**
 * Iterate over each case in an object, evaluate its value, and invoke a callback.
 *
 * For each key-value pair in `cases`:
 *   - If the value is an object, recurses (optionally using a provided `caller`).
 *   - If the value is a function, invokes it with the accumulated `result` and coerces to boolean.
 *   - Otherwise, coerces the raw value to boolean.
 *
 * The callback receives the evaluated value, the key, and the running result
 * object. If the callback returns a non-undefined value, that value is returned
 * from `booleanCases` instead of the accumulated result.
 *
 * @typeParam T - The type of the cases object.
 * @param cases - An object whose values are the conditions to evaluate.
 * @param callback - Optional function called for each evaluated case.
 * @param caller - Optional override for recursive object evaluation.
 * @returns The callback's return value if defined; otherwise the accumulated result object.
 */
export const booleanCases = <T extends Cases>(cases: T, callback?: Callback<T>, caller?: any) => {
  // Accumulator: one entry per key, filled in iteration order and shared with every callback
  const result: any = {};
  // objectEach stops the walk as soon as the callback returns a non-undefined value
  const feedback = objectEach(cases, ({ key, value: caseValue }: any) => {
    // Route the raw value through typeSwitch so that only real objects recurse
    const value: any = typeSwitch(caseValue, {
      // Objects recurse; a supplied `caller` replaces that recursion and its return becomes the value
      object: () => (caller ? caller(caseValue) : booleanCases(caseValue, callback)),
      // Functions are called with the accumulator built so far, then coerced with !!
      function: () => !!caseValue(result),
      // Arrays, dates and class instances land here: they are plain `!!value` coercions
      default: () => !!caseValue,
    });
    // Written before the callback runs, so the callback already sees the current key
    result[key] = value;
    // A non-undefined callback return becomes `feedback` and short-circuits the objectEach walk
    return callback
      ? callback({
          value,
          key,
          result,
        })
      : undefined;
  });

  // A defined `feedback` wins verbatim (even `0` / `null`); otherwise the accumulated result is returned
  return feedback !== undefined ? feedback : result;
};
