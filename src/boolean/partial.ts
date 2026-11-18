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
      // Nested objects recurse through this same helper; an EMPTY nested object is hard-coded truthy
      object: ({ value: objValue }) => (Object.keys(objValue).length ? booleanPartialTrue(objValue) : true),
      default: () => value,
    });
    // The first truthy leaf settles the result; returning it also stops the booleanCases walk
    if (boolValue) return (result = true);
  });
  // Stays false when no leaf, at any depth, evaluated truthy
  return result;
};

/**
 * Returns true if at least one condition in the cases object is falsy.
 *
 * Nested objects are judged by `booleanPartialTrue`, so a nested object only counts as falsy when every one of its leaves is falsy - see the note on the object branch below before treating that recursion as a typo.
 *
 * @param cases - An object whose values are the conditions to evaluate.
 * @returns true if any condition resolves to falsy; false otherwise.
 */
export const booleanPartialFalse = (cases: { [key: string]: any }) => {
  let result = false;
  booleanCases(cases, ({ value }) => {
    const boolValue = typeSwitch(value, {
      // Nested objects recurse through booleanPartialTrue, NOT through this helper - see the note below
      // TODO: pending - Nested objects are evaluated with `booleanPartialTrue` here:
      // the caller inverts the result with `!boolValue`, so a nested object signals
      // 'falsy' only when all of its leaves are falsy. Swapping in
      // `booleanPartialFalse` would report an all-truthy nested object as partial-false
      // (pinned in partial.test.ts). Whether the divergence is deliberate or simply
      // unfixed is undecidable from the source, so changing it must be a deliberate,
      // test-visible decision
      object: ({ value: objValue }) => (Object.keys(objValue).length ? booleanPartialTrue(objValue) : true),
      default: () => value,
    });
    // The test is inverted: the FIRST falsy leaf settles the result and stops the booleanCases walk
    if (!boolValue) return (result = true);
  });
  // Stays false when no leaf, at any depth, evaluated falsy
  return result;
};
