/**
 * Object merge utility.
 *
 * Deep-merges multiple objects into one. Nested objects are merged
 * recursively rather than replaced. Use `objectUpdate` for shallow
 * (non-nested) overwrites.
 */

import { isObject } from '../is';
import { objectEach } from './each';

/**
 * Deep-merges any number of objects into a single new object.
 *
 * For each property, if both the existing and incoming values are objects,
 * they are recursively merged. Otherwise the incoming value overwrites.
 *
 * Cycles are not tracked: a two-sided cycle (`a.self = a`, `b.self = b`) recurses until the
 * stack overflows with a `RangeError`. A one-sided cycle simply carries the cyclic object
 * over by reference. See the cycle tests.
 *
 * @param list - The objects to merge (left-to-right, later objects win on conflicts).
 * @returns A new object containing the deep-merged result.
 */
export const objectMerge = (...list: { [key: string]: any }[]): { [key: string]: any } => {
    // Accumulator: the merged result is always a brand new object; neither input is mutated
    const result: { [key: string]: any } = {};
    // Arguments are applied left to right, so a later item overwrites what earlier ones accumulated
    list.forEach((item) => {
        objectEach(item, ({ key, value }) => {
            // Plain-object test. `isObject` (constructor === Object) is the same predicate the
            // previous `typeSwitch(value, { object })` dispatch selected, so arrays, class
            // instances, functions, null and every primitive still overwrite wholesale.
            if (isObject(value)) {
                // Get the Current Value once; the merge and the overwrite branch share it
                const currentValue = result[key];

                // If the accumulated value is not a plain object there is nothing to merge into:
                // overwrite by reference, otherwise deep-merge the two
                result[key] = isObject(currentValue) ? objectMerge(currentValue, value) : value;
            } else {
                // Non-plain values replace wholesale, and the incoming reference is shared (no clone)
                result[key] = value;
            }
        });
    });
    return result;
};
