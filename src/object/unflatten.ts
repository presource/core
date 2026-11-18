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

// The nested shape being built, and the signature of the unflatten pass
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
    // The nested object that gets returned
    const result: Item = {};

    objectEach(input, ({ key: chain, value }) => {
        // Walk down from the root for this key chain: `previous` is the parent of
        // `current`, and `pointer` is the segment of the parent that owns `current`.
        let previous: any = result;
        let current: any = previous;
        let pointer: any;

        const appendValue = (addValue: any) => {
            // Anything already parked at this level under '' is buffered, not overwritten
            const savedValue = current[''];
            let newValue = savedValue;

            if (savedValue !== undefined) {
                // Second (or later) collision: promote the buffer to a list
                newValue = arrayEnsures(savedValue);

                // Append the new value to that list
                newValue.push(addValue);
            } else {
                newValue = addValue;
            }
            // Store the buffered value back at the empty-string key
            current[''] = newValue;
        };

        // Walk the dot-separated chain, opening one branch per segment
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

            // Step down one level and remember which segment we came through
            previous = current;
            current = current[key];
            pointer = key;
        });

        // Adding to Current Pointer. `isObject` matches the previous `typeSwitch` "object"
        // bucket: only plain objects recurse, everything else (arrays included) is appended.
        if (isObject(value)) {
            // Object value: unflatten it and merge the result into the branch just opened
            previous[pointer] = objectMerge(current, objectUnflatten(value));
        } else {
            // Leaf value: buffer it at the current level
            appendValue(value);
        }

        // Flattening out a level that exists only to hold a buffered collision
        const currentKeys = Object.keys(current);
        if (currentKeys.length === 1 && currentKeys[0] === '') {
            // If the only key left is the empty-string buffer, the wrapper was unnecessary:
            // lift the buffered value to the parent in its place
            previous[pointer] = current[''];
        }
    });

    return result;
};
