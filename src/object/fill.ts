/**
 * Object fill utility.
 *
 * Fills missing properties on a target object with values from a source
 * fill object. Only keys not already present on the target are added.
 */
import { objectEach } from './each';
import { objectHasKey } from './has';

/**
 * Adds properties from `fill` into `object` for every key that does not already exist.
 *
 * Mutates `object` in place, then returns a shallow copy.
 *
 * @param object - The target object to fill (mutated).
 * @param fill - The source object whose missing keys will be copied over.
 * @returns A shallow copy of the updated `object`.
 */
export const objectFill = (object: any, fill: { [key: string]: any }): typeof object => {
  objectEach(fill, ({ key, value }) => {
    if (!objectHasKey(object, key)) {
      object[key] = value;
    }
  });
  return { ...object };
};
