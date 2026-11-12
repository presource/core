/**
 * boolean/true
 *
 * Provides a utility for evaluating whether ALL conditions in a case object
 * are truthy. Returns true only when every evaluated case resolves to true.
 */

import { booleanCases } from './cases';

/**
 * Evaluate all conditions; returns true only if every case is truthy.
 *
 * Iterates over each key in the `cases` object, evaluates its value (delegated
 * to `booleanCases`), and short-circuits to false on the first falsy result.
 *
 * @param cases - An object whose values are the conditions to evaluate.
 * @returns true if all conditions are truthy; false otherwise.
 */
export const booleanTrue = (cases: { [key: string]: any }) => {
  let result = true;
  booleanCases(cases, ({ value }) => {
    if (!value) return (result = false);
  });
  return result;
};
