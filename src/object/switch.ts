/**
 * Object switch utility.
 *
 * Provides switch-case-like behavior over object keys. The first matching
 * key in the data triggers the corresponding case callback.
 */

import { objectHasKey } from './has';

/** Callback argument object with re-loop helpers for each registered case. */
type Argument<T> = {
  /** The matched property key. */
  key: string;
  /** The value associated with the matched key. */
  value: any;
  /** Re-invokes `objectSwitch` with the default case key to allow re-dispatch. */
  default: (value: any) => any;
} & { [key in keyof T]: (value: any) => any };

/** A case callback that receives the argument object. */
type Callback<T> = (args: Argument<T>) => any;

/** Map of case keys to callbacks, with an optional `default` fallback. */
type Cases<T> = { default?: Callback<T> } & { [key in keyof T]: Callback<T> };

type Data = { [key: string]: any };

type Structure = <T>(value: Data, cases: Cases<T>) => any;

/**
 * Evaluates an object against a set of switch-case callbacks.
 *
 * Iterates over the own enumerable keys of `cases` (excluding `default`) and invokes the
 * first callback whose key exists in `data`. The callback receives re-loop
 * functions for every case key, enabling chained re-dispatch. If no
 * case matches, the optional `default` fallback is invoked.
 *
 * @param data - The object to match against.
 * @param cases - A map of keys to case callbacks, optionally with a `default`.
 * @returns The result of the triggered callback, or `undefined`.
 */
export const objectSwitch: Structure = (data, cases) => {
  // Widened once so the loop can index the cases map with its own runtime keys.
  const handlers = cases as unknown as { [key: string]: Callback<any> | undefined };

  // `default` is read explicitly instead of destructuring the map apart. A plain property
  // read walks the prototype chain, which keeps the previous `{ default: fallback, ...rest }`
  // semantics exactly: an *inherited* `default` still becomes the fallback, while `rest`
  // (own enumerable keys only) never contained it. See the inherited-default test.
  const fallback = cases.default;

  // Own enumerable case keys, in insertion order. Case insertion order (not data order)
  // decides the winner, and `default` stays in this list because the params object exposed
  // a re-loop helper for it too.
  const caseKeys = Object.keys(cases);

  // The callback parameter object. It is materialised lazily: the "no case matched and no
  // fallback" path returns undefined without ever handing params to caller code, so none of
  // the re-loop closures are created in that case.
  let params: any;
  const getParams = () => {
    if (params) return params;

    params = {};
    for (const key of caseKeys) {
      // Smart Reloop function: re-enters objectSwitch with `{ [key]: caseFunction }` as the
      // data, so the argument a caller passes is ignored by design. The case function is
      // captured now (not at call time) to mirror the previous eager objectMap snapshot.
      const handler = handlers[key];
      params[key] = () => objectSwitch({ [key]: handler }, cases);
    }

    return params;
  };

  // The Trigger tells when the object has hit a switch, and result keeps the last defined
  // callback return value (the walk only short-circuits on a defined result).
  let triggered = false;
  let result: any;

  for (const key of caseKeys) {
    // A `default` entry is the fallback, never a match candidate: the previous rest-spread
    // excluded it from the iterated cases while keeping it available on params.
    if (key === 'default') continue;
    // Checking if data has the key (own keys only, so inherited data keys never match)
    if (!objectHasKey(data, key)) continue;

    // Set Trigger to True For Switch to know when to stop
    triggered = true;

    const currentParams = getParams();
    // Updating the Params with Value and Key. `value` is written before `key` so the
    // parameter object keeps the insertion order the previous objectUpdate produced.
    currentParams.value = data[key];
    currentParams.key = key;

    // Triggering the Value function (the case handler itself, not its re-loop helper)
    result = handlers[key]!(currentParams);
    // Matching a case that returns undefined does not stop the walk, so later matching
    // cases still run and the last defined return value wins.
    if (result !== undefined) break;
  }

  // Testing Return result
  if (triggered) return result;
  // if Fallback is Triggered instead. The truthiness guard is kept on purpose: a non-function
  // truthy `default` still surfaces the same TypeError callers saw before.
  if (fallback) return fallback(getParams());
  // Else return undefined.
};
