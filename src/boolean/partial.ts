/**
 * boolean/partial
 *
 * Utilities for partial boolean evaluation. Checks whether ANY (at least one)
 * condition in a case object is truthy or falsy, with recursive support for
 * nested objects.
 */

import { typeSwitch } from '../type';

import { booleanCases } from './cases';

/**
 * Returns true if at least one condition in the cases object is truthy.
 *
 * Recursively evaluates nested objects: an empty nested object is treated as
 * truthy (true), while a non-empty nested object is evaluated by recursing
 * into `booleanPartialTrue`.
 *
 * @param cases - An object whose values are the conditions to evaluate.
 * @returns true if any condition resolves to truthy; false otherwise.
 */
export const booleanPartialTrue = (cases: { [key: string]: any }) => {
  let result = false;
  booleanCases(cases, ({ value }) => {
    const boolValue = typeSwitch(value, {
      // Recursive if it is an Object
      object: ({ value: objValue }) => (Object.keys(objValue).length ? booleanPartialTrue(objValue) : true),
      default: () => value,
    });
    // If boolValue is true. Return result as true
    if (boolValue) return (result = true);
  });
  // Return the Final Result
  return result;
};

/**
 * Returns true if at least one condition in the cases object is falsy.
 *
 * Recursively evaluates nested objects the same way as `booleanPartialTrue`.
 *
 * @param cases - An object whose values are the conditions to evaluate.
 * @returns true if any condition resolves to falsy; false otherwise.
 */
export const booleanPartialFalse = (cases: { [key: string]: any }) => {
  let result = false;
  booleanCases(cases, ({ value }) => {
    const boolValue = typeSwitch(value, {
      // Recursive if it is an Object
      // TODO: pending - BUG: booleanPartialFalse incorrectly calls booleanPartialTrue for nested objects. Should be booleanPartialFalse(value)
      object: ({ value: objValue }) => (Object.keys(objValue).length ? booleanPartialTrue(objValue) : true),
      default: () => value,
    });
    // If boolValue is true. Return result as true
    if (!boolValue) return (result = true);
  });
  // Return the Final Result
  return result;
};
