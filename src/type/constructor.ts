/**
 * Returns the constructor function of a value, or `undefined` if the
 * value is `null` or `undefined` (since those have no constructor).
 *
 * @param value - Any value to inspect.
 * @returns The constructor function (e.g. `String`, `Number`, `Array`)
 *          or `undefined` when the value lacks a constructor.
 */
export const typeConstructor = (value: any) => value?.constructor;
