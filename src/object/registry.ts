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
 * - Called with an `array`: maps the array by looking up each element as a registry key.
 * - Called with a `function`: invokes it with an `{ each }` handler for iteration.
 * - Called with no arguments: returns the raw registry object.
 *
 * @param registry - Optional initial registry store. Defaults to an empty object.
 * @returns A polymorphic accessor function.
 */
export const objectRegistry = (registry: { [key: string]: any } = {}) => {
    // Constructing the Accessor Function
    const accessor = (key?: Key | HandlerFunction, value?: any) =>
        // Matching typeof key against certain values
        typeSwitch(key, {
            // Handler Function
            function: ({ value }) =>
                // Triggering Self
                value({
                    // Each Function. Looping back with object Each
                    each: (callback: EachCallback) => objectEach(registry, (data) => callback(data))
                }),
            // If Array. Return Proper Values
            array: ({ value }) => objectCreate(value, ({ value: k }) => registry[k]),
            // if it is number. treat it as a string key lookup
            number: (data) => data.string(data.value),
            // if key is string
            string: ({ value: keyValue }) => {
                // If value is undefined. Return the Registry with Key
                if (value === undefined) return registry[keyValue];
                // Updating the Registry
                registry[keyValue] = value;
                // returning the accessor Function
                return accessor;
            },
            // If Object. update the Registry
            object: ({ value }) => objectUpdate(registry, value),
            // For Everything Else. Return Registry
            default: () => registry
        });
    // returning the accessor function to consume
    return accessor;
};
