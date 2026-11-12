/**
 * Function type guards.
 *
 * Provides predicates for detecting regular functions and async functions
 * by inspecting the runtime type name.
 */
import { typeName } from '../type';

// Type names used by JavaScript engines to identify function kinds
const nameFunctionSync = 'function';
const nameFunctionAsync = 'asyncfunction';

/**
 * Checks whether a value is a function (sync or async).
 *
 * Inspects the value's type name and returns `true` if it matches either
 * `'function'` or `'asyncfunction'`, covering both traditional and async
 * function declarations.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is a function, narrowing the type accordingly.
 */
export const isFunction = (unknown: any): unknown is (...args: any[]) => void => {
  // Direct comparisons instead of `[a, b].includes(...)`: no per-call array
  // literal is allocated and no linear scan runs (M14). Behaviour-identical —
  // `Array.prototype.includes` uses the same SameValueZero equality as `===`
  // for these two primitive string type names.
  const name = typeName(unknown);
  return name === nameFunctionSync || name === nameFunctionAsync;
};

/**
 * Checks whether a value is specifically an async function.
 *
 * Narrows more precisely than {@link isFunction} by only matching
 * values whose type name is `'asyncfunction'`.
 *
 * @param unknown - The value to test.
 * @returns `true` if the value is an async function, narrowing the type accordingly.
 */
export const isFunctionAsync = (unknown: any): unknown is (...args: any[]) => Promise<any> =>
  typeName(unknown) === nameFunctionAsync;
