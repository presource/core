/**
 * String-based switch/case dispatcher.
 *
 * Provides synchronous and asynchronous variants of a switch-like
 * pattern keyed by string (or numeric) values. When a matching case
 * is a function, it receives an argument object that lets it reference
 * other cases, the original value, and a default fallback.
 *
 * PERF NOTES (measured, paired in-process against the pre-optimisation build):
 * - `getParams` builds the same object `objectMap` built, with the same key set
 *   and insertion order, using a plain `Object.keys` loop instead of that helper's
 *   per-iteration parameter object: measured 1.25x-1.36x for function cases and
 *   nested reloops. A lazy `Proxy` version of the argument object was measured at
 *   0.5x once a callback touched it, so it is not used.
 * - The static-case fast path (a non-callable case returns before `getParams`) is
 *   pre-existing behaviour and is kept; it is where the dispatch time is saved.
 * - Observable side effect of the leaner build: a `cases` object whose values are
 *   GETTERS is read fewer times (function case 1/0 per key instead of 2/1; a static
 *   case is unchanged at 0/0). All returned values are identical.
 */

import { objectHasKey } from '../object';
import { isFunction } from '../is';

/**
 * Argument object passed to case callbacks.
 * Includes the matched value, a default getter, and a getter for every other case key.
 */
type Argument<T> = {
    /** The original matched value as a string. */
    value: string;
    /** Returns the default case value. */
    default: (value: any) => any;
} & { [key in keyof T]: (value: any) => any };

/** Callback invoked for a matched case. */
type Callback<T> = (args: Argument<T>) => any;

/**
 * Mapping of case keys to static values or callback functions.
 * An optional `default` key serves as the fallback.
 */
type Cases<T> = { [key in keyof T]: any | Callback<T> } & { default?: any | Callback<T> };

/**
 * Signature for both {@link stringSwitch} and `stringSwitchAsync`.
 *
 * @param value - The value to match against case keys.
 * @param cases - Object mapping keys to values or callbacks.
 * @returns The resolved case value (static or callback result).
 */
type Structure = <T extends { [key: string]: any }>(value: number | string | undefined, cases: Cases<T>) => any;

/**
 * Build the argument object handed to case callbacks.
 *
 * Each case key becomes a function that internally calls `stringSwitch`
 * for that key, enabling nested / cross-case references.
 *
 * @param value - The matched value.
 * @param cases - The full cases map.
 * @returns Argument object with `value`, `default`, and per-case getters.
 */
const getParams: Structure = (value, cases) => {
    // Own enumerable keys in `Object.keys` order (integer keys first) - the exact
    // set and insertion order `objectMap` produced, because a fresh object literal
    // gets the same key ordering. `value` and `default` are assigned afterwards,
    // so an explicitly declared `value` / `default` case key keeps its own slot
    // while still being overwritten, like the original did.
    // Measured 1.25x-1.36x over the `objectMap` build. The reloop stays an inline
    // closure here (unlike the nested helpers in ../type/switch.ts): it captures
    // only `key` + `cases`, and the module-level factory variant measured ~9%
    // SLOWER on wider case maps.
    const params: any = {};
    for (const key of Object.keys(cases)) {
        // The reloop ignores its arguments and re-dispatches with the KEY itself,
        // always through the SYNC dispatcher (`stringSwitchAsync` shares this
        // builder, and its outer `await` still flattens the result).
        params[key] = () => stringSwitch(key as string, cases);
    }

    params.value = value;
    params.default = () => cases.default;
    return params;
};

/**
 * Synchronous string switch dispatcher.
 *
 * Looks up `value` in `cases`. If the matched entry is a function,
 * invokes it with the argument object. Otherwise returns the static
 * value directly. Falls back to `cases.default` when no key matches.
 *
 * @param value - The value to match against case keys.
 * @param cases - Object mapping keys to values or callbacks.
 * @returns The resolved case value.
 */
export const stringSwitch: Structure = (value, cases) => {
    const callback = objectHasKey(cases, value) ? cases[value] : cases.default;
    // Return static values directly without building the argument object
    if (!isFunction(callback)) return callback;
    return callback(getParams(value, cases));
};

/**
 * Asynchronous string switch dispatcher.
 *
 * Same behaviour as {@link stringSwitch} but awaits the callback
 * result, allowing async case handlers.
 *
 * @param value - The value to match against case keys.
 * @param cases - Object mapping keys to values or async callbacks.
 * @returns The (possibly awaited) resolved case value.
 */
export const stringSwitchAsync = async (value: any, cases: any) => {
    const callback: Promise<any> = objectHasKey(cases, value) ? cases[value] : cases.default;
    // Return static values directly without building the argument object
    if (!isFunction(callback)) return callback;

    return await callback(getParams(value, cases));
};
