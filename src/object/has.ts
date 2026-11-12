/**
 * Object key-check utility.
 *
 * Determines whether an object has a given property as an own (non-inherited) key.
 */

/**
 * Type-guard that checks whether `object` has `key` as an own enumerable property.
 *
 * @typeParam T - The type of the object.
 * @param object - The object to check.
 * @param key - The property key to test.
 * @returns `true` if `key` is an own property of `object`.
 */
export const objectHasKey = <T extends {}>(object: T, key: any): key is keyof T => object.hasOwnProperty(key);
