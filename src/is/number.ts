/**
 * Number type guard.
 *
 * Provides a predicate for detecting numeric values.
 */
import { typeConstructor } from '../type';

/**
 * Checks whether a value is a number.
 *
 * Compares the value's constructor against the global `Number` constructor.
 * Note: `NaN` is considered a number here — its constructor is still
 * `Number`, so this returns `true` for `NaN`.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value's constructor is `Number`.
 */
export const isNumber = (unknown: any): unknown is number => typeConstructor(unknown) === Number;
