/**
 * Object switch utility.
 *
 * Provides switch-case-like behavior over object keys. Case keys are walked in their own
 * insertion order, and the first case key present in the data triggers its callback.
 */

import { objectHasKey } from './has';

/** Callback argument object with re-loop helpers for each registered case. */
type Argument<T> = {
  /** The matched property key. Absent on the fallback path, where no case matched. */
  key: string;
  /** The value associated with the matched key. Also absent when only the fallback ran. */
  value: any;
  /**
   * Re-loop helper for the `default` entry. It re-enters `objectSwitch` with
   * `{ default: <the default handler> }` as the data; `default` is never a match
   * candidate, so the walk falls straight through to the fallback and `cases.default`
   * runs a second time (pinned by "a default reloop helper runs the fallback exactly
   * once" in src/object/switch.test.ts).
   */
  default: (value: any) => any;
  // One re-loop helper per registered case key. Like the `default` helper above, each one
  // ignores its argument: it re-dispatches with `{ [key]: <the case handler> }` as the data,
  // so the handler arrives as `value` instead of the caller's argument.
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
 * Walks the own enumerable keys of `cases` in insertion order (`default` is never a match
 * candidate) and invokes every callback whose key exists in `data`. The walk stops at the
 * first callback that returns a defined value, so a matching case returning `undefined`
 * lets later matching cases run. Once any case has matched, its return value is the
 * result and the `default` fallback never runs; only a walk that matched nothing invokes
 * the fallback. Each callback receives re-loop functions for every case key, enabling
 * chained re-dispatch.
 *
 * @param data - The object to match against.
 * @param cases - A map of keys to case callbacks, optionally with a `default`.
 * @returns The first defined callback result - from a case or, if nothing matched, from the
 *          fallback; `undefined` when nothing produced one (a case matched but returned
 *          undefined, or nothing matched and the fallback returned undefined / was absent).
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

    // Record that a case matched: this flag alone decides whether the `default`
    // fallback may still run. The walk itself stops on a defined result (below).
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

  // Any match at all wins over the fallback, even a case that returned undefined
  if (triggered) return result;
  // Nothing matched: fall back to `default` when one was registered. The truthiness guard
  // is kept on purpose: a non-function truthy `default` still surfaces the same TypeError
  // callers saw before.
  if (fallback) return fallback(getParams());
  // No case matched and no fallback exists, so the function simply ends and yields undefined
};
