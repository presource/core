/**
 * Object key-check utility.
 *
 * Determines whether an object has a given property as an own (non-inherited) key.
 */

/**
 * Type-guard that checks whether `object` has `key` as an own (non-inherited) property.
 *
 * Enumerability is NOT part of the test: `hasOwnProperty` also answers `true` for a
 * non-enumerable own property, and inherited keys never match.
 *
 * @typeParam T - The type of the object.
 * @param object - The object to check.
 * @param key - The property key to test.
 * @returns `true` if `key` is an own property of `object`.
 */
export const objectHasKey = <T extends {}>(object: T, key: any): key is keyof T => object.hasOwnProperty(key);
