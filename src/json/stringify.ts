/**
 * JSON stringification utilities.
 *
 * Converts a value to its JSON string representation.
 * Uses an ancestor-stack replacer to detect circular references and
 * silently omits keys (or returns `undefined` for array elements)
 * whose values would create a cycle — matching the "skip, don't throw"
 * contract that callers expect.
 *
 * Native `JSON.stringify` throws `TypeError: Converting circular
 * structure to JSON` when it encounters a cycle. This implementation
 * returns `undefined` for circular descendants instead of aborting.
 *
 * ## How the ancestor stack works
 *
 * The replacer is called _for every property_ during the depth‑first
 * traversal that `JSON.stringify` performs.  We maintain a stack of
 * objects representing the current path from the root to the node
 * being processed.
 *
 *   - **Push** when we encounter a new object (entering a subtree).
 *   - **Pop** when `this` changes to a different parent: we remove
 *     everything from the stack above that parent, because those
 *     objects were siblings / cousins that are now fully serialized.
 *   - **Skip** (return `undefined`) if the current value already
 *     exists in the ancestor stack — that indicates a genuine cycle.
 *
 * A plain `WeakSet` (all visited objects) is **not** sufficient because
 * it would also skip objects that are merely shared between siblings
 * (e.g. `{ a: ref, b: ref }`), which is valid JSON with no cycle.
 *
 * ## Cycle check cost: linear scan first, identity `Set` only on deep paths
 *
 * The cycle check runs once per property. `ancestors.includes` is O(depth)
 * but is a tight pointer scan, while a `Set` mirror is O(1) per lookup and
 * pays a hash insert + delete per visited object. Measured on this
 * implementation (Temp/coding-datajson/bench-m9.mjs.ts):
 *
 *   - shallow + wide payloads (depth < 150, thousands of keys — the common
 *     case) run 20-40% SLOWER with an always-on Set,
 *   - the crossover sits around depth 150-200, and past depth 400 the Set is
 *     1.2-1.36x faster, where the quadratic scan starts to dominate.
 *
 * So the mirror is built lazily, the first time the path reaches
 * `DEEP_PATH_SIZE`, and maintained from then on for the rest of the call.
 * Shallow documents never allocate it at all; deep ones get O(1) lookups.
 * Both branches answer the same question (is `value` on the current path),
 * so the produced string is identical either way.
 */

/**
 * Path length at which the linear `includes` scan is replaced by the lazily
 * built identity `Set`. Chosen above the measured crossover (~150-200) so the
 * extra structure is only paid for by documents deep enough to benefit.
 */
const DEEP_PATH_SIZE = 256;

/**
 * Convert a value to a JSON string.
 *
 * Circular references are handled gracefully: any object that is an
 * ancestor of itself in the current traversal path is replaced with
 * `undefined`, causing `JSON.stringify` to omit that key (object) or
 * emit `null` (array element).  The function never throws on cyclic
 * structures.
 *
 * The ancestor-stack approach correctly distinguishes between:
 *  - **True circular references** – object appears in its own ancestor
 *    chain → omit / null.
 *  - **Sibling-shared references** – same object referenced by two
 *    unrelated properties → serialize normally (valid JSON).
 *
 * @param item - The value to stringify.
 * @returns The JSON string representation of *item*, with circular
 *          descendant keys omitted.
 */
export const jsonStringify = (item: any): string => {
  // Stack of ancestor objects along the current traversal path.
  // Only objects are pushed (primitives and null never enter it).
  const ancestors: object[] = [];

  // Lazily built identity mirror of `ancestors` — see the module header. It stays
  // `null` for every path shorter than `DEEP_PATH_SIZE`, which is the common case.
  let onPath: Set<object> | null = null;

  return JSON.stringify(item, function (this: any, _key: string, value: any): any {
    // --- 1. Primitives and null pass through unchanged ---
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    // --- 2. Pop ancestors that are no longer on the current path ---
    //
    // `this` is the parent object that owns the property being processed.
    // On the initial root call, `JSON.stringify` internally wraps the
    // value in `{ '': item }` and calls the replacer with that wrapper
    // as `this`.  The wrapper is never in our stack, so the loop simply
    // empties the stack (correct — nothing is an ancestor of root).
    //
    // For every subsequent call, `this` IS one of the objects that was
    // previously pushed.  We pop until the top of the stack *is* `this`,
    // removing any sibling / cousin subtrees that have been fully
    // serialized. Every popped node also leaves the mirror, which is what
    // keeps a re-used sibling object from looking like a cycle.
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      const left = ancestors.pop() as object;
      // Only pay for the mirror while it exists (i.e. a deep path built it).
      if (onPath !== null) {
        onPath.delete(left);
      }
    }

    // --- 3. Detect circular reference ---
    //
    // If `value` is already on the ancestor path, the current property
    // closes a cycle.  Return `undefined` so that:
    //  - for objects: the key is omitted from output
    //  - for arrays: the element becomes `null` (JSON.stringify's
    //    standard treatment of undefined array elements)
    if (ancestors.length >= DEEP_PATH_SIZE) {
      // Seed the mirror from the whole path on first use, then it is kept in
      // sync by the push/pop steps below for the remainder of this call.
      onPath = onPath ?? new Set(ancestors);

      if (onPath.has(value)) {
        return undefined;
      }
    } else if (ancestors.includes(value)) {
      return undefined;
    }

    // --- 4. Push current object onto the ancestor stack ---
    //
    // This ensures its descendants can be checked against it. A value is only
    // pushed after the check above missed, so the stack (and the mirror) can
    // never hold the same object twice.
    ancestors.push(value);

    if (onPath !== null) {
      onPath.add(value);
    }

    return value;
  });
};
