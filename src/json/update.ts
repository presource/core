/**
 * JSON deep-merge utilities.
 *
 * Provides a recursive merge function that combines two JSON-compatible
 * values (objects, arrays, or primitives). When both values share the same
 * type, their contents are merged element-by-element; otherwise the
 * secondary value wins.
 */

import { objectEach } from '../object';

import { isObject } from '../is';

/**
 * Recursively merge a secondary JSON value into a primary one.
 *
 * - If both values share the same type and are not equal:
 *   - Arrays: merge element-by-element by index.
 *   - Objects: merge property-by-property by key.
 *   - Otherwise: the secondary value replaces the primary.
 * - If types differ: the secondary value is returned as-is.
 * - If the values are `===`-equal the primary is returned. HEAD returned the secondary in
 *   that case, which is the same value apart from the `0`/`-0` pair (see the identity
 *   guard below) — a genuine delta, pinned in src/json/update.test.ts.
 *
 * ## Dispatch model (perf)
 *
 * The old implementation paid two `typeName()` calls (constructor lookup +
 * lower-casing) plus a `typeSwitch()` dispatch (which allocates an args
 * object and a wrapper callback per case) on **every recursion node**.
 * Those calls are now replaced by the two predicates below, which are the
 * only shapes that can actually merge:
 *
 * - Only "both arrays" merges by index and only "both plain objects" merges
 *   by key. Every other combination produced `result = secondaryObject`
 *   before as well, because the previous `default` branch and the
 *   "types differ" branch return the identical value — so collapsing them
 *   into one fall-through is behaviour-preserving.
 * - `typeName` equality used to lump `null`, `undefined` and prototype-less
 *   objects together (all three yield `''`). Those pairs still fell into the
 *   `default` branch and returned the secondary, which the fall-through
 *   below reproduces.
 *
 * Intentional divergence: an exotic primary that *pretends* to be a
 * container through its own `constructor.name` (e.g.
 * `{ constructor: { name: 'Array' } }`) used to satisfy `typeName` equality
 * and be replaced by a freshly built `[]`/`{}`; it is now treated as a
 * non-container, so the secondary reference is returned as-is. Values are
 * deep-equal either way, and the secondary reference is what every real
 * container mismatch already returned.
 *
 * @param primaryObject - The base value to merge into.
 * @param secondaryObject - The value to merge on top of the primary.
 * @returns The merged result (a new or updated reference).
 */
// TODO: pending - BUG: let result = primaryObject mutates original. Should clone first
export const jsonUpdate = (primaryObject: any, secondaryObject: any) => {
  // Fast path for identical values: the same reference, or a `===`-equal primitive pair
  // such as `0`/`-0`. HEAD had no guard here — its `else` branch ALWAYS returned the
  // secondary — so a shared reference stays indistinguishable (secondary === primary),
  // while the `===`-equal-but-distinct pair is a genuine delta: `jsonUpdate(0, -0)` used
  // to return `-0` and now returns `0`, and `jsonUpdate(-0, 0)` used to return `0` and now
  // returns `-0`. `NaN` never compares equal, so it still falls through to the secondary.
  if (primaryObject === secondaryObject) return primaryObject;

  // Both arrays: merge element-by-element by index. `forEach` (rather than a
  // plain loop) keeps the existing hole-skipping semantics for sparse arrays.
  if (Array.isArray(primaryObject) && Array.isArray(secondaryObject)) {
    secondaryObject.forEach((value: any, index: number) => {
      primaryObject[index] = jsonUpdate(primaryObject[index], value);
    });

    return primaryObject;
  }

  // Both plain objects: merge property-by-property by key. `objectEach` only
  // walks own enumerable string keys, matching the previous behaviour.
  if (isObject(primaryObject) && isObject(secondaryObject)) {
    objectEach(secondaryObject, ({ value, key }) => {
      primaryObject[key] = jsonUpdate(primaryObject[key], value);
    });

    return primaryObject;
  }

  // Everything else (type mismatch, primitives, `null`, built-ins such as
  // Date/Map/RegExp, class instances, prototype-less objects) — secondary wins
  // outright, by reference and without cloning.
  return secondaryObject;
};
