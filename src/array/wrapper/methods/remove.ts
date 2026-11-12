/**
 * Wrapper `remove` method implementation.
 *
 * Removes elements from the wrapped array based on a key selection request.
 * Mutates the underlying array and returns the instance for chaining.
 *
 * PERFORMANCE CONTRACT (H3): compaction runs in a single forward pass. The
 * previous implementation called `element.splice(pointer, 1)` once per removal,
 * and every splice shifts the whole tail, so removing k of n elements was
 * O(n*k) — measured 965x slower than a rebuild at n=1000, k=500.
 * See Temp/coding-perf/bench-out.txt. `retain` (retain.ts:41) funnels here, so
 * it inherits the same fix.
 */

import { Params } from '..';

import { keysFunction } from './keys';

/**
 * Signature for the remove method handler.
 */
type RemoveFunction = (params: Params, request: Parameters<typeof keysFunction>[1]) => any;

/**
 * Removes matching elements from the wrapped array in place.
 *
 * Resolves matching indexes via `keys`, marks them in a Set, copies every
 * surviving slot forward and truncates `length`. The public contract is
 * unchanged: the SAME array instance is mutated, surviving elements keep their
 * relative order, the final length is `length - removedCount`, and the wrapper
 * is returned for chaining.
 *
 * Edge decisions (kept identical to the old splice loop):
 * - Holes: `Array#splice` moved a hole as a hole, so a shifted hole stays a
 *   hole and never becomes an explicit `undefined` entry.
 * - Extra own properties (`arr.foo = x`) are untouched by the copies and survive
 *   the truncation, just like they survived every splice call.
 * - Stale index properties left in the tail are removed by the `length` write.
 * - Indexes outside 0..length-1 remove nothing (built-in `keys` never emits them).
 *
 * @param params - The wrapper parameter object.
 * @param request - The filter criteria to determine which elements to remove.
 * @returns The wrapper instance for chaining.
 */
export const removeFunction: RemoveFunction = (params, request) => {
    const { element, instance } = params;
    // Resolve matching indexes from the request (sorted + unique, keys.ts)
    const keys = instance.keys(request);
    // Nothing selected: leave the array untouched (no truncation side effects).
    if (keys.length === 0) return instance;

    // Mark the original indexes to drop. Membership testing replaces the old
    // `pointer = value - index` offset bookkeeping entirely, so the result no
    // longer depends on the order or uniqueness of `keys`.
    const marked = new Set<any>(keys);
    const length = element.length;
    // `write` is the destination slot of the next surviving element; it never
    // exceeds `read`, which is what makes the forward compaction in-place safe.
    let write = 0;

    for (let read = 0; read < length; read++) {
        // Dropped slots are simply skipped, so their values disappear naturally.
        if (marked.has(read)) continue;

        // While no element has been dropped yet `read === write`: the surviving
        // prefix must not be rewritten at all, otherwise holes in it would be
        // materialised into explicit `undefined` entries.
        if (write !== read) {
            const value = element[read];
            // A hole and an explicit `undefined` both read as `undefined`, so the
            // HasProperty check is only paid when the value actually is undefined
            // (rare for dense arrays). A hole must be reproduced as a hole.
            if (value !== undefined || read in element) element[write] = value;
            else delete element[write];
        }

        write++;
    }

    // Truncating `length` deletes the stale index properties left behind by the
    // copies (indexes >= write) while leaving non-index own properties in place.
    element.length = write;

    return instance;
};
