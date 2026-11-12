/**
 * Wrapper `keys` method implementation.
 *
 * Resolves a filter request into an array of matching indexes (keys).
 * Supports filtering by number, string keyword, boolean, or combined arrays.
 *
 * PERFORMANCE CONTRACT (H2): the request is first COMPILED into per-criterion
 * flags, then ONE filter-aware pass collects the matching indexes. The previous
 * implementation ran one full `instance.each` pass per criterion (and one proxy
 * property read per pass), which is O(n*m) — measured 301x slower than the
 * Set-based single pass at n=1000, m=200. See Temp/coding-perf/bench-out.txt.
 */

import { Params } from '..';
import { isInvalid } from '../../../is/invalid';
import { stringSwitch } from '../../../string/switch';
import { typeSwitch } from '../../../type/switch';


/** Supported request types for key resolution. */
type Request = boolean | string | number | (boolean | string | number)[];

/**
 * Signature for the keys method handler.
 */
type KeysFunction = (params: Params, request: Request) => any[];

/**
 * Returns an array of indexes matching the given request criteria.
 *
 * - A number matches by exact index.
 * - A string keyword ("valid", "invalid", "odd", "even") filters by value/trait.
 * - A boolean matches elements whose truthiness equals the given value.
 * - An array combines multiple criteria (union of all matching indexes).
 * - Omitted request returns all indexes.
 *
 * The result is always sorted ascending and free of duplicates. That is a
 * property of the single ascending collection pass, not of a post-sort:
 * `arrayEach` (src/array/each.ts:76-87) visits index 0..length-1 exactly once
 * in ascending order, so pushing matches yields ascending, unique indexes for
 * free. The consumer contract depends on it: `remove` (remove.ts) and `get`
 * (get.ts) both read the indexes as live positions.
 *
 * Every criterion is evaluated against the FILTERED population, because the
 * collection pass runs through `instance.each` (methods/each.ts), which applies
 * the active `select`/config predicates.
 *
 * @param params - The wrapper parameter object.
 * @param request - The filter criteria.
 * @returns A sorted, unique array of matching indexes.
 */
export const keysFunction: KeysFunction = (params, request) => {
    const { instance } = params;

    // Collected output: ascending + unique by construction (see JSDoc above).
    const result: number[] = [];

    // --- Compiled criteria -------------------------------------------------
    // The union semantics of the old multi-pass version is exactly an OR over
    // the criteria, so every criterion collapses into a flag (or a Set entry for
    // numbers, which are the only per-value criteria) and one pass can decide.
    const numbers = new Set<number>();
    // `hasCriteria` stays false when nothing in the request is a recognised
    // criterion (e.g. keys('bogus') or keys([{}])) — that path never iterated
    // before either, so it must yield [] without touching the array.
    let hasCriteria = false;
    // `matchAll` mirrors the old `default` branch: a request that is not an
    // array/number/string/boolean (undefined/null/object/function) selects all.
    let matchAll = false;
    let matchValid = false;
    let matchInvalid = false;
    let matchOdd = false;
    let matchEven = false;
    let matchTruthy = false;
    let matchFalsey = false;

    /**
     * Compiles one criterion into the flag set above.
     * Shared by the scalar request and by every element of an array request, so
     * both paths keep the exact per-criterion semantics of the old handlers.
     */
    const addCriterion = (criterion: any) =>
        typeSwitch(criterion, {
            number: ({ value }) => {
                // Old test was `index === value`; Set lookup is equivalent for
                // every number, including the never-matching ones (-1, 1.5, 99,
                // NaN), which simply never appear as an iteration index.
                numbers.add(value);
                hasCriteria = true;
            },
            boolean: ({ value }) => {
                // Old test was `value === !!element`, which splits in two flags.
                if (value) matchTruthy = true;
                else matchFalsey = true;
                hasCriteria = true;
            },
            string: ({ value }) =>
                stringSwitch(value, {
                    valid: () => {
                        matchValid = true;
                        hasCriteria = true;
                    },
                    invalid: () => {
                        matchInvalid = true;
                        hasCriteria = true;
                    },
                    odd: () => {
                        matchOdd = true;
                        hasCriteria = true;
                    },
                    even: () => {
                        matchEven = true;
                        hasCriteria = true;
                    }
                    // No `default`: an unknown keyword ('bogus', '') matched no
                    // case in the old implementation either, so it contributes
                    // nothing and must leave `hasCriteria` untouched.
                })
            // No other criterion type is selectable: the old nested dispatch only
            // declared number/boolean/string, so e.g. keys([[1]]) added nothing.
        });

    // Compile the request into the criteria set above.
    typeSwitch(request, {
        // An array request is the union of its criteria, so each one compiles.
        array: ({ value: values }) => {
            values.forEach(addCriterion);
        },
        // Scalar criteria compile directly through the same helper.
        number: () => addCriterion(request),
        string: () => addCriterion(request),
        boolean: () => addCriterion(request),
        // Any other request type (undefined/null/object/function) is "no request".
        default: () => {
            matchAll = true;
        }
    });

    // Nothing selectable in the request: `keys('bogus')` / `keys([])` used to run
    // zero passes and return an empty list, and so do we.
    if (!matchAll && !hasCriteria) return result;

    /**
     * Combined predicate for the single collection pass: an index is selected
     * when ANY compiled criterion matches, which is exactly the union the old
     * implementation produced by running one pass per criterion.
     */
    const matches = (index: number, value: any) => {
        if (matchAll) return true;
        // Index traits first: cheapest checks, no value read required.
        if (matchOdd && index % 2 !== 0) return true;
        if (matchEven && index % 2 === 0) return true;
        // Truthiness criteria (`value === !!element`).
        if (matchTruthy && !!value) return true;
        if (matchFalsey && !value) return true;
        // Value traits. `isInvalid` is strictly null | undefined, so 0/''/false stay valid.
        if (matchInvalid && isInvalid(value)) return true;
        if (matchValid && !isInvalid(value)) return true;
        // Exact-index criteria last; `has` is trivially false for an empty Set.
        return numbers.has(index);
    };

    // ONE pass over the filtered population, and only ONE proxy property read.
    // Block-bodied callback: it must not return a value, or `arrayEach` would
    // short-circuit the whole pass (each.ts:83 treats non-undefined as "stop").
    instance.each(({ index, value }: any) => {
        if (matches(index, value)) result.push(index);
    });

    return result;
};
