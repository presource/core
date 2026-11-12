/**
 * Object iteration (each) utility.
 *
 * Iterates over the own enumerable properties of an object, invoking a
 * callback for each. Supports both synchronous and async variants.
 * Iteration short-circuits when the callback returns a non-undefined value.
 */

/** Arguments passed to the `each` callback. */
type Arguments<T, K extends keyof T> = {
    /** Array of the object's keys. */
    array: keyof T;
    /** Current property key. */
    key: K;
    /** Current property value. */
    value: T[K];
    /** The object being iterated. */
    object: T;
    /** Zero-based iteration index. */
    index: number;
    /** Total number of properties. */
    length: number;
    /** Return value from the most recent callback invocation. */
    result: any;
    /** The callback function itself. */
    callback: Callback<T, K>;
};

/** Callback invoked for each property during iteration. Return non-undefined to break early. */
type Callback<T, K extends keyof T> = (args: Arguments<T, K>) => any;

type Structure = <T extends {}, K extends keyof T>(object: T, callback: Callback<T, K>) => any;

/**
 * Builds the shared mutable parameter object used by both sync and async `each` loops.
 *
 * @param object - The object to iterate.
 * @param callback - The per-property callback.
 * @returns An argument object with all property names.
 */
const getParams: Structure = (object, callback) => {
    const array = Object.keys(object);
    const params = {
        array,
        key: undefined,
        value: undefined,
        index: 0,
        object,
        length: array.length,
        result: undefined,
        callback
    };

    return params;
};

/**
 * Synchronously iterates over each property of an object.
 *
 * Returns early (short-circuits) when the callback returns a non-undefined value.
 *
 * @param object - The object to iterate.
 * @param callback - Invoked for each property. Return non-undefined to break.
 * @returns The last callback return value, or `undefined` if none broke the loop.
 */
export const objectEach: Structure = (object, callback) => {
    const params = getParams(object, callback);
    // Running Loop Function
    for (; params.index < params.length; params.index++) {
        params.key = params.array[params.index];
        params.value = params.object[params.key];
        params.result = callback(params);
        if (params.result !== undefined) break;
    }
    // Always return the last result
    return params.result;
};

/**
 * Asynchronously iterates over each property of an object.
 *
 * Awaits the callback for each property. Short-circuits when the callback
 * returns a non-undefined value.
 *
 * @param object - The object to iterate.
 * @param callback - Invoked (awaited) for each property. Return non-undefined to break.
 * @returns The last callback return value, or `undefined` if none broke the loop.
 */
export const objectEachAsync: Structure = async (object, callback) => {
    // Get the params
    const params = getParams(object, callback);
    for (; params.index < params.length; params.index++) {
        params.key = params.array[params.index];
        params.value = params.object[params.key];
        params.result = await callback(params);
        if (params.result !== undefined) break;
    }
    return params.result;
};
