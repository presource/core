/**
 * Invalid value type guard.
 *
 * Provides a predicate for detecting "invalid" values, defined as either
 * `null` or `undefined`.
 */
/**
 * Checks whether a value is invalid (either `null` or `undefined`).
 *
 * Performs the strict `null` / `undefined` equality checks directly,
 * as a single convenience predicate.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is `null` or `undefined`, narrowing the type accordingly.
 */
export const isInvalid = (unknown: any): unknown is null | undefined => unknown === null || unknown === undefined;
