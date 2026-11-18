/**
 * Object registry utility.
 *
 * Provides a fluent accessor for storing, retrieving, and iterating
 * key-value pairs in a shared registry object.
 */
import { typeSwitch } from '../type';
import { objectUpdate } from './update';
import { objectCreate } from './create';
import { objectEach } from './each';

/** Acceptable key types for the registry accessor. */
type Key = string | { [key: string]: any };

/** Argument object passed to the `each` iteration callback. */
type Argument = {
    /** The registry key. */
    key: string | number;
    /** The stored value. */
    value: any;
    /** Zero-based index during iteration. */
    index: number;
    /** The registry object. */
    object: { [key: string]: any };
};

/** Callback invoked for each registry entry during `each` iteration. */
type EachCallback = (data: Argument) => any;

/** Handler function invoked when the accessor is called with a function argument. */
type HandlerFunction = (handler: { each: (callback: EachCallback) => any }) => any;

/**
 * Creates a registry accessor for storing, retrieving, and iterating key-value pairs.
 *
 * The returned `accessor` is polymorphic:
 * - Called with a `string` key: gets the value (or sets it if a second `value` argument is provided).
 * - Called with an `object`: bulk-updates the registry via `objectUpdate`.
 * - Called with an `array`: builds a PLAIN OBJECT keyed by each requested element, where every
 *   value is that key's registry entry (keys missing from the registry are present with an
 *   `undefined` value) — it does not return an array.
 * - Called with a `function`: invokes it with an `{ each }` handler for iteration.
 * - Called with no arguments: returns the raw registry object.
 *
 * @param registry - Optional initial registry store. Defaults to an empty object.
 * @returns A polymorphic accessor function.
 */
export const objectRegistry = (registry: { [key: string]: any } = {}) => {
    // The polymorphic accessor: `typeSwitch` picks a branch from the request's runtime type
    const accessor = (key?: Key | HandlerFunction, value?: any) =>
        typeSwitch(key, {
            // If Function, hand the handler object straight back to the caller ("triggering self")
            function: ({ value }) =>
                value({
                    // `each` forwards the whole registry walk to the caller's callback
                    each: (callback: EachCallback) => objectEach(registry, (data) => callback(data))
                }),
            // If Array, build `{ [requestedKey]: registryValue }` via objectCreate
            array: ({ value }) => objectCreate(value, ({ value: k }) => registry[k]),
            // If Number, reuse the string branch so the number is coerced into a property key
            number: (data) => data.string(data.value),
            // If String, read (no `value` argument) or write (with one)
            string: ({ value: keyValue }) => {
                // Read mode: a bare key access just returns the stored entry
                if (value === undefined) return registry[keyValue];
                // Write mode: store the entry, then hand back the accessor for chaining
                registry[keyValue] = value;
                return accessor;
            },
            // If Object, bulk-update the registry and return the mutated registry object
            object: ({ value }) => objectUpdate(registry, value),
            // Anything else (including no arguments at all) returns the raw registry object
            default: () => registry
        });
    return accessor;
};
