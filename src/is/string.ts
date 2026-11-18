/**
 * String type guard.
 *
 * Provides the `isString` predicate for detecting string primitives and
 * `String` wrapper objects. Emptiness checks live in ./empty.ts (`isEmpty`),
 * not here.
 */
import { typeConstructor } from '../type';

/**
 * Checks whether a value is a string.
 *
 * Compares the value's constructor against the global `String` constructor
 * to determine if the value is a string primitive or String wrapper.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is a string, narrowing the type accordingly.
 */
export const isString = (unknown: any): unknown is string => typeConstructor(unknown) === String;


