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

/** Argument object passed to the callback for each evaluated case. */
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
  // The Complete Result
  const result: any = {};
  // Using Object Each
  const feedback = objectEach(cases, ({ key, value: caseValue }: any) => {
    // Triggering the Value Evaluations
    const value: any = typeSwitch(caseValue, {
      // Special case: Recursive. Nested Result. Route through the caller if it is given, however.
      object: () => (caller ? caller(caseValue) : booleanCases(caseValue, callback)),
      // If It is a Function. Evaluate It Accordingly
      function: () => !!caseValue(result),
      // By Default. Evaluate the Value as it is
      default: () => !!caseValue,
    });
    // Updating the Ongoing Result
    result[key] = value;
    // Triggering the Callback
    return callback
      ? callback({
          value,
          key,
          result,
        })
      : undefined;
  });

  // Only Return the Feedback if it is not undefined. Else. Return the Result
  return feedback !== undefined ? feedback : result;
};
