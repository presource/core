/**
 * Object type guard.
 *
 * Provides a predicate for detecting plain objects (non-array, non-null objects).
 */
import { typeConstructor } from '../type';

/**
 * Checks whether a value is a plain object.
 *
 * Compares the value's constructor against the global `Object` constructor,
 * which excludes arrays, functions, and primitives.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is a plain object, narrowing the type accordingly.
 */
export const isObject = (unknown: any): unknown is { [key: string]: any } =>
  typeConstructor(unknown) === Object;
