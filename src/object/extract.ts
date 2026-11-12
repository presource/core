/**
 * Object extract utility.
 *
 * Extracts values from an object using dot-notation paths with optional
 * array bracket indexing (e.g. `"a.b[0].c"`).
 */

import { isObject } from '../is';
import { typeSwitch } from '../type';

/** Signature of the extract function. */
export type ObjectExtract = (object: { [key: string]: any }, extract: any) => any;

/**
 * Module-scope regex literals for `parseSegment`.
 *
 * `parseSegment` runs once per dot-separated path segment, so an inline literal would
 * allocate a brand new RegExp object on every segment of every call. Hoisting them keeps
 * a single instance per pattern. Both are stateless in the way they are used here:
 * neither relies on `lastIndex` (`String.prototype.match` resets `lastIndex` to 0 before
 * scanning when the pattern is global), so sharing them across calls is safe.
 */
const BRACKET_PATTERN = /^([^\[]*)((?:\[\d+\])*)$/;
const DIGIT_PATTERN = /\d+/g;

/**
 * Parses a single dot-separated path segment, resolving any bracket indexes.
 *
 * Supports notation like `"fruits[0][1]"` — first accesses the `fruits` key,
 * then walks each numeric bracket index into nested arrays.
 *
 * @param pointer - The current object or array being traversed.
 * @param segment - A single path segment, possibly with `[n]` bracket notation.
 * @returns The resolved value, or `undefined` on failure.
 */
const parseSegment = (pointer: any, segment: string): any => {
    // Match a key and any number of bracket indexes, e.g. "fruits[0][1]"
    const match = segment.match(BRACKET_PATTERN);

    if (!match) return undefined;

    const [, key, indexes] = match;

    // Access the key first (if present). `isObject` already guarantees a non-null object,
    // so no optional chaining is needed on the lookup.
    let value = key ? (isObject(pointer) ? pointer[key] : undefined) : pointer;

    // Then step through each [index] in order
    if (indexes) {
        // The `((?:\[\d+\])*)` capture only ever yields complete `[digits]` groups, so a
        // non-empty `indexes` always produces at least one digit match (no `?? []` fallback).
        const indexMatches = indexes.match(DIGIT_PATTERN) as string[];
        for (const idx of indexMatches) {
            if (value === undefined) return undefined;
            value = Array.isArray(value) ? value[Number(idx)] : undefined;
        }
    }

    return value ?? undefined;
};

/**
 * Extracts one or more values from an object using a path string, array of paths, or number.
 *
 * - **string**: Walks the dot-separated path (with optional `[n]` bracket notation) and returns the value.
 * - **array**: Maps over each element and recursively extracts, returning an array of results.
 * - **number**: Currently returns `undefined` (reserved for future use).
 *
 * @param object - The object to extract from.
 * @param extract - A path string, array of paths, or number.
 * @returns The extracted value(s), or `undefined`.
 */
export const objectExtract: ObjectExtract = (object: any, extract: any) => {
    // Depending on what value extract is, the result could be different
    const result: any = typeSwitch(extract, {
        number: () => {
            // TODO: pending - Number case unimplemented. Decide what behavior is expected
            // !Not sure what to do with number yet
            return undefined;
        },
        // If String. Use Drilling path. If only single path, better to use direct access!
        string: ({ value }) => {
            let pointer = object;
            // Split on "." then parse each segment for bracket notation
            value.split('.').forEach((segment: string) => {
                pointer = parseSegment(pointer, segment);
            });

            return pointer;
        },
        array: ({ value: values, string, number, array }) => {
            // if array, accessing multiple instances
            return values.map((element: any) => {
                return typeSwitch(element, {
                    number: () => number(element),
                    string: () => string(element),
                    array: () => array(element),
                    default: () => undefined
                });
            });
        }
    });

    return result;
};
