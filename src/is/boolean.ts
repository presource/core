/**
 * Boolean type guards.
 *
 * Provides predicates for detecting boolean values and for checking
 * whether a value is specifically `true` or `false`.
 */
import { typeConstructor } from '../type';

/**
 * Checks whether a value is a boolean.
 *
 * Compares the value's constructor against the global `Boolean` constructor.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is a boolean, narrowing the type accordingly.
 */
export const isBoolean = (unknown: any): unknown is boolean => typeConstructor(unknown) === Boolean;

/**
 * Checks whether a value is strictly equal to `true`.
 *
 * @param value - The value to test.
 * @returns `true` if the value is strictly `true`; `false` otherwise.
 */
// TODO: pending - Missing type predicate: should be (value: any): value is true
export const isBooleanTrue = (value: any) => value === true;

/**
 * Checks whether a value is strictly equal to `false`.
 *
 * @param value - The value to test.
 * @returns `true` if the value is strictly `false`; `false` otherwise.
 */
// TODO: pending - Missing type predicate: should be (value: any): value is false
export const isBooleanFalse = (value: any) => value === false;
