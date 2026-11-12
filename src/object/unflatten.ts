/**
 * Object unflatten utility.
 *
 * Attempts to reverse the effect of flattening an object by converting
 * dot-separated keys back into nested structures. Not 100% lossless
 * because flattening is not a 1-to-1 operation.
 */
import { arrayEnsures } from '../array';
import { isObject } from '../is';
import { toString } from '../to';
import { objectEach } from './each';
import { objectMerge } from './merge';

// The Expanding Structure
type Item = { [key: string]: any };
type Structure = (input: Item) => Item;

/**
 * Reconstructs a nested object from a flattened object with dot-notation keys.
 *
 * Splits each key on `.` and builds nested objects. When a collision occurs
 * at a level, values are wrapped under an empty-string key (`''`) to avoid
 * overwriting. If the value itself is an object, it is recursively unflattened
 * and merged.
 *
 * @param input - A flattened object with dot-separated keys.
 * @returns A nested object reconstructed from the flattened input.
 */
export const objectUnflatten: Structure = (input) => {
    // The result that is returned
    const result: Item = {};

    objectEach(input, ({ key: chain, value }) => {
        // Let the current is the result

        let previous: any = result;
        let current: any = previous;
        let pointer: any;

        const appendValue = (addValue: any) => {
            // This is to save the buffered value
            const savedValue = current[''];
            let newValue = savedValue;

            if (savedValue !== undefined) {
                newValue = arrayEnsures(savedValue);

                // Adding New value to the List of Array
                newValue.push(addValue);
            } else {
                newValue = addValue;
            }
            // Updating the Current Value Place
            current[''] = newValue;
        };

        // Scanning through the object chain, and reading each key
        toString(chain).split('.').forEach((key) => {
            // Making sure that current is always an object. The three branches are exactly what
            // the previous `typeSwitch(current[key], ...)` produced: a plain object is kept as
            // the branch, a missing/undefined slot becomes a fresh object, and any other value
            // (array, null, class instance, primitive, function) is buffered under ''.
            const existing = current[key];

            if (existing === undefined) {
                // Missing slot: open a fresh branch
                current[key] = {};
            } else if (!isObject(existing)) {
                // Occupied by a non-branch value: park it under the empty key
                current[key] = { '': existing };
            }
            // A plain object is already a usable branch, so it stays in place

            // Save Object to Previous
            previous = current;
            current = current[key];
            // Saving the Pointer to Store Value into
            pointer = key;
        });

        // Adding to Current Pointer. `isObject` matches the previous `typeSwitch` "object"
        // bucket: only plain objects recurse, everything else (arrays included) is appended.
        if (isObject(value)) {
            // if Value is an object, run recursive
            previous[pointer] = objectMerge(current, objectUnflatten(value));
        } else {
            // Appending Value to the Current Pointer Position
            appendValue(value);
        }

        // Shifting Data
        const currentKeys = Object.keys(current);
        if (currentKeys.length === 1 && currentKeys[0] === '') {
            // If Currenty keys is only 1, and it only includes the empty space
            // Then move it to top level
            previous[pointer] = current[''];
        }
    });

    // Returning the Result
    return result;
};
