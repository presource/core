/**
 * Promise type guard.
 *
 * Provides a predicate for detecting whether a value is a `Promise` instance.
 */
import { typeConstructor } from '../type';

/**
 * Checks whether a value is a `Promise`.
 *
 * Compares the value's constructor against the global `Promise` constructor.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is a `Promise`, narrowing the type accordingly.
 */
export const isPromise = (unknown: any): unknown is Promise<any> =>
  typeConstructor(unknown) === Promise;
