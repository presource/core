/**
 * Wrapper `select` method implementation.
 *
 * Filters the wrapped array by appending a new predicate to the
 * configuration, returning a new wrapper instance for chaining.
 */

import { Params } from '..';
import { arrayEach } from '../../each';
import { typeSwitch } from '../../../type';


// TODO: pending - null and undefined in Possible type but unhandled in typeSwitch
/** Primitive and nullish types accepted as filter values. */
type Possible = string | boolean | number | null | undefined;

/**
 * Argument object passed to filter callbacks.
 */
type Arguments = {
    /** The index of the current element. */
    index: number;
    /** The value of the current element. */
    value: any;
};

/** Custom filter callback that returns true to include an element. */
type FilterCallback = (args: Arguments) => boolean;

/** The request type: a single value, an array of values, or a callback. */
type Request = Possible | Possible[] | FilterCallback;

/**
 * Signature for the select method handler.
 */
type SelectFunction = (params: Params, request: Request) => any;

/**
 * Creates a new wrapper that applies an additional filter.
 *
 * The filter is appended to the existing config filters, so multiple
 * `select` calls compose. Does not mutate the underlying array.
 *
 * @param params - The wrapper parameter object.
 * @param request - The filter criteria: a value, array of values, or callback.
 * @returns A new wrapper instance with the additional filter applied.
 */
export const selectFunction: SelectFunction = (params, request) => {
    const { wrapper, element, config } = params;

    // Reuses (does not clone) the existing filter list: when config.filter
    // already exists, this push also extends the parent config's filter array
    const filter = config.filter || [];
    filter.push((data) => {
        return typeSwitch(request, {
            // Number: match by exact index
            number: ({ value }) => value === data.index,
            // Array: pass if any of the sub-criteria matches
            array: ({ value: values, number, string, boolean }) => {
                return arrayEach(values, ({ value: elementValue }) => {
                    const result = typeSwitch(elementValue, {
                        number: () => number(elementValue),
                        string: () => string(elementValue),
                        boolean: () => boolean(elementValue)
                    });
                    // Short-circuit on first match
                    if (result) return true;
                });
            },
            // Default: accept all elements
            default: () => true
        });
    });

    // Create a fresh wrapper with the extended filter config
    return wrapper(element, { ...config, filter });
};
