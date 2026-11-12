/**
 * Validation utilities.
 *
 * Provides helpers for determining whether a value is considered
 * "valid" (i.e., not null and not undefined).
 */
import { isInvalid } from './invalid';

/**
 * Checks whether a value is valid (neither null nor undefined).
 *
 * This is the logical negation of {@link isInvalid}. A value is
 * considered valid if it is not `null` and not `undefined`.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is neither null nor undefined; `false` otherwise.
 */
export const isValid = (unknown: any) => !isInvalid(unknown);
