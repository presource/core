/**
 * Wrapper `retain` method implementation.
 *
 * Keeps only the elements that satisfy the given callback predicate,
 * removing all others. The inverse of `remove`.
 */

import { Params } from '..';

/** Argument passed to the retain callback. */
type Arguments = any;

/**
 * Predicate callback that returns true to keep an element, false to discard it.
 */
type Callback = (args: Arguments) => boolean;

/**
 * Signature for the retain method handler.
 */
type RetainFunction = (params: Params, callback: Callback) => any;

/**
 * Retains only the elements for which the callback returns true.
 *
 * Collects the indexes of elements that fail the predicate, then
 * removes them in a single `remove` call.
 *
 * @param params - The wrapper parameter object.
 * @param callback - Predicate function; return true to keep, false to remove.
 * @returns The wrapper instance for chaining.
 */
export const retainFunction: RetainFunction = (params, callback) => {
    const { instance } = params;
    // Collect indexes of elements that should be removed
    const toRemoveKeys: number[] = [];
    instance.each((data: any) => {
        if (!callback(data)) toRemoveKeys.push(data.index);
    });
    // Remove all collected indexes in one operation
    instance.remove(toRemoveKeys);
    return instance;
};
