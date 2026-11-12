/**
 * Wrapper `is` method implementation.
 *
 * Evaluates whether the wrapped array satisfies a given condition,
 * such as being empty, filled, valid, or invalid.
 *
 * PERFORMANCE NOTE (L3): `empty`/`filled`/`valid`/`invalid` normally run full
 * `instance.count()` passes. That is deliberate (trade-off T6) — `count` walks
 * `instance.each`, so active `select` predicates narrow the population. When the
 * wrapper provably has NO filter predicates, the early-exit scans below are
 * equivalent and stop at the first decisive element instead of walking the
 * whole array (`count()` vs `arr.length` measured a 1532x gap at n=1000).
 */

import { Params } from '..';
import { isInvalid } from '../../../is';
import { stringSwitch } from '../../../string';
import { typeSwitch } from '../../../type';

/** Supported condition keywords for the `is` method. */
type RequestString = 'empty' | 'filled' | 'valid' | 'invalid';

/** The request type alias used by the is method. */
type Request = RequestString;

/**
 * Signature for the is method handler.
 */
type IsFunction = (params: Params, request: Request) => boolean;

/**
 * Early-exit scan for "at least one element is null/undefined".
 * Equivalent to `count('invalid') > 0` when no filters are active: `element[i]`
 * reads a hole as `undefined`, exactly the value `each` would have seen.
 */
const hasInvalidValue = (element: any[]) => {
    for (let index = 0; index < element.length; index++) {
        if (isInvalid(element[index])) return true;
    }
    return false;
};

/**
 * Early-exit scan for "at least one element is undefined".
 * Equivalent to `count('undefined') > 0` when no filters are active.
 */
const hasUndefinedValue = (element: any[]) => {
    for (let index = 0; index < element.length; index++) {
        if (element[index] === undefined) return true;
    }
    return false;
};

/**
 * Checks whether the wrapped array satisfies the given condition.
 *
 * - "empty": true if the array has zero elements.
 * - "filled": true if non-empty and contains no undefined values.
 * - "valid": true if no elements are considered invalid.
 * - "invalid": true if at least one element IS invalid — i.e. the inverse of
 *   "valid". `valid` here is the sibling-case dispatcher supplied by
 *   `stringSwitch`, so it must be INVOKED (`valid()`); negating the function
 *   reference itself always yielded false.
 * - Unknown keyword: false. A non-string request: true (passthrough branch).
 *
 * @param params - The wrapper parameter object.
 * @param request - The condition keyword to check.
 * @returns True if the condition is satisfied, false otherwise.
 */
export const isFunction: IsFunction = (params, request) => {
    const { instance, element, config } = params;

    // Cheap, provable "no filters active" detection: `config.filter` is the ONLY
    // filter source (`each.ts:44` reads `config.filter || []`), and a root
    // wrapper gets `{}` as config, so the guard must tolerate a missing filter.
    // With no predicates, `each` visits every index 0..length-1 exactly once, so
    // a plain scan sees the identical population; with predicates we must keep
    // the `count()` path or filtered-out elements would be judged anyway.
    const filters = config && config.filter;
    const unfiltered = !filters || filters.length === 0;

    return typeSwitch(request, {
        string: () =>
            stringSwitch(request, {
                empty: () => (unfiltered ? element.length === 0 : instance.count() === 0),
                valid: () => (unfiltered ? !hasInvalidValue(element) : instance.count('invalid') === 0),
                invalid: ({ valid }: any) => (unfiltered ? hasInvalidValue(element) : !valid()),
                // "filled" means non-empty with no undefined entries
                filled: ({ empty }: any) =>
                    unfiltered
                        ? element.length > 0 && !hasUndefinedValue(element)
                        : !empty() && instance.count('undefined') === 0,
                default: () => false
            }),

        // When request is not a string, return true by default
        default: () => true
    });
};
