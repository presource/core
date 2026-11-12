/**
 * Wrapper `count` method implementation.
 *
 * Counts elements in the wrapped array, optionally filtering by type
 * name (e.g., "string", "number", "valid", "invalid").
 */

import { Params } from '..';
import { isBoolean, isInvalid, isNumber, isObject, isString, isValid } from '../../../is';
import { objectHasKey } from '../../../object';
import { typeSwitch } from '../../../type';

/** Supported type-name filters for counting. */
type RequestString = 'string' | 'object' | 'boolean' | 'number' | 'invalid' | 'valid' | 'null' | 'undefined';

/** The request type alias used by the count method. */
type Request = RequestString;

/**
 * Signature for the count method handler.
 */
type CountFunction = (params: Params, request: Request) => number;

/**
 * `null` keyword predicate.
 * Module scope (L2): these two checkers used to be re-created as fresh closures
 * on every `count()` call, together with the whole options map below.
 */
const isNull = (value: any) => value === null;

/** `undefined` keyword predicate (holes count, they read as undefined). */
const isUndefined = (value: any) => value === undefined;

/**
 * Map of type names to their corresponding type-checking functions.
 * Hoisted to module scope (L2) so the 8-entry object is allocated once per
 * module instead of once per `count()` call.
 */
const COUNT_CHECKS: { [key in RequestString]: (value: any) => boolean } = {
    string: isString,
    object: isObject,
    number: isNumber,
    boolean: isBoolean,
    invalid: isInvalid,
    valid: isValid,
    null: isNull,
    undefined: isUndefined
};

/**
 * Shared always-true predicate used for unrecognised keywords.
 * Also module scope (L2) to avoid one closure allocation per call.
 */
const COUNT_ALL = () => true;

/**
 * Counts elements in the wrapped array.
 *
 * When `request` is omitted or not a recognized type name, counts all elements.
 * When `request` is a type name string, counts only elements matching that type.
 *
 * Uses `instance.each` rather than direct iteration so that `select`-based
 * filters are also respected.
 *
 * @param params - The wrapper parameter object.
 * @param request - Optional type-name filter to narrow the count.
 * @returns The number of matching elements.
 */
export const countFunction: CountFunction = (params, request) => {
    const { instance } = params;
    let count = 0;

    // Use `instance.each` so that any active `select` filters are applied
    instance.each(
        typeSwitch(request, {
            // When request is a type-name string, count only matching elements
            string: ({ value }) => {
                // Unrecognized keywords (e.g. 'bogus') have no checker entry.
                // Per the documented contract they fall back to "count all",
                // matching the non-string/default branch below, instead of
                // throwing `checkFunction is not a function`.
                // `objectHasKey` guards the lookup so inherited keys
                // ('constructor', 'toString', ...) cannot masquerade as checkers.
                const checkFunction = objectHasKey(COUNT_CHECKS, value) ? COUNT_CHECKS[value] : COUNT_ALL;

                return (data: any) => {
                    if (checkFunction(data.value)) count++;
                };
            },
            // Default: count every element that passes through
            default: () => {
                return () => {
                    count++;
                };
            }
        })
    );
    return count;
};
