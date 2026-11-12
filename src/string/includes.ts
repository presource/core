/**
 * Advanced string inclusion matcher.
 *
 * Checks whether any of a set of string keys are present inside a target
 * string, then collects the associated values (or callback results) for
 * every match. Similar to `String.prototype.includes` but supports
 * multiple keys and dynamic callback resolution.
 */

import { isFunction } from '../is';
import { objectEach, objectMap } from '../object';

/**
 * Argument object provided to each case callback.
 * Contains the original value plus helper functions for referencing other cases.
 */
type Argument<T> = {
    /** The original string being tested. */
    value: string;
} & { [key in keyof T]: (value?: string) => any };

/** Callback invoked when a case key is found inside the target string. */
type Callback<T> = (args: Argument<T>) => any;

/**
 * Mapping of substring keys to either static values or callback functions.
 * If a key (converted to string) is found inside `value`, the
 * corresponding entry is captured in the result.
 */
type Cases<T> = { [key in keyof T]: Callback<T> | string | boolean | any[] };

/**
 * Signature for {@link stringIncludes}.
 *
 * @param value - The target string to search inside.
 * @param cases - Object whose keys are substrings and whose values are results or callbacks.
 * @returns An object containing only the matched keys and their resolved values.
 */
type Structure = <T>(value: string, cases: Cases<T>) => { [key in keyof T]: any };

/**
 * `objectMap` mapper for the delegation object: function cases are handed
 * through RAW (so `params.foo` keeps the original reference) and every static
 * case becomes a zero-argument `() => caseValue` accessor.
 *
 * Hoisted to module scope so a match allocates no mapper closure either.
 *
 * @param args - `objectMap` callback argument (only `value` is used).
 * @returns The value exposed for that case key on the argument object.
 */
const toDelegate = ({ value: caseValue }: { value: any }) => (isFunction(caseValue) ? caseValue : () => caseValue);

/**
 * Test whether any of the provided keys appear inside `value` and return
 * the resolved value for each match.
 *
 * Each key of `cases` is coerced to a string and checked with
 * `String.prototype.includes`. When a match is found the associated
 * value is captured; if the value is a function it is invoked with the
 * argument object.
 *
 * The delegation object is built on the FIRST match instead of up front, which is
 * the whole saving when nothing matches (measured 4.3x) and a no-op when something
 * does (measured 1.0x, identical callback arguments either way).
 *
 * Observable side effect: a `cases` object whose values are GETTERS is read fewer
 * times when no key matches (1 read per key instead of 2, because `objectMap` no
 * longer runs); with at least one match the read counts are identical.
 *
 * @param value - The string to search inside.
 * @param cases - Mapping of substring keys to static values or callbacks.
 * @returns Object of matched keys and their resolved values.
 */
export const stringIncludes: Structure = (value, cases) => {
    // TODO: pending - Return type is any but Structure declares { [key in keyof T]: any }. Mismatch
    const found: any = {};

    // The delegation object is only observable to callback cases, so it is built
    // on the first match instead of up front: `objectMap` used to allocate a
    // wrapper closure for EVERY key even when nothing matched at all. Same
    // contents, and it is reused by every further match of the same call.
    let params: any = null;

    objectEach(cases, ({ key, value: caseValue }) => {
        const k = key.toString();
        if (value.includes(k)) {
            // `{ value, ...params }` stays a fresh object per match: the original
            // spread meant each callback owned its own copy, and a case literally
            // keyed `value` still shadows the target string.
            params ??= objectMap(cases, toDelegate);
            found[k] = isFunction(caseValue) ? caseValue({ value, ...params }) : caseValue;
        }
    });
    return found;
};
