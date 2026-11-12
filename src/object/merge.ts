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
    // Standard Result Object
    const result: { [key: string]: any } = {};
    // Scanning Through Array List
    list.forEach((item) => {
        // Scanning through each object
        objectEach(item, ({ key, value }) => {
            // Plain-object test. `isObject` (constructor === Object) is the same predicate the
            // previous `typeSwitch(value, { object })` dispatch selected, so arrays, class
            // instances, functions, null and every primitive still overwrite wholesale.
            if (isObject(value)) {
                // Get the Current Value once; the merge and the overwrite branch share it
                const currentValue = result[key];

                // Guard clause, if current value is not an object. Overwrite by reference,
                // otherwise return the Combination of the two
                result[key] = isObject(currentValue) ? objectMerge(currentValue, value) : value;
            } else {
                // If not object. Overwrite
                result[key] = value;
            }
        });
    });
    // Returning the FInal result
    return result;
};
