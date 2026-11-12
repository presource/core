/**
 * Wrapper `each` method implementation.
 *
 * Iterates over the wrapped array elements, applying configured filter
 * predicates before invoking the user callback. Returns the instance
 * for method chaining.
 */

import { arrayEach } from '../../each';
import { Params } from '..';

/**
 * Argument object passed to the each callback.
 */
type Argument = {
    /** The index of the current element. */
    index: number;
    /** The value of the current element. */
    value: any;
};

/** Callback invoked for each matching element. */
type Callback = (args: Argument) => any;

/**
 * Signature for the each method handler.
 */
type EachFunction = (params: Params, callback: Callback) => any;

/**
 * Iterates over the wrapped array, invoking the callback only for elements
 * that pass all configured filter predicates.
 *
 * @param params - The wrapper parameter object.
 * @param callback - The function to invoke for each matching element.
 * @returns The wrapper instance for chaining.
 */
export const eachFunction: EachFunction = (params, callback) => {
    const { element, config, instance } = params;

    // Determines whether a value passes all registered filter predicates
    const valueSelected = (data: any) => {
        // arrayEach returns early (truthy) if any filter predicate rejects the value
        const skipValue = arrayEach(config.filter || [], ({ value }) => {
            const check = value(data, params);
            // If a filter returns false, short-circuit and mark as skipped
            if (!check) return true;
        });
        // Value is selected only if no filter rejected it
        return !skipValue;
    };

    arrayEach(element, (data) => {
        if (valueSelected(data)) {
            return callback(data);
        }
    });

    return instance;
};
