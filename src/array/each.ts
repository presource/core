/**
 * Array iteration utilities.
 *
 * Provides synchronous and asynchronous `each` functions that iterate
 * over arrays with a rich parameter object. Iteration short-circuits
 * when the callback returns a non-undefined value.
 */

/**
 * Parameter object passed to the each callback.
 *
 * @template T - The element type of the array.
 */
type Argument<T> = {
    /** The current index. */
    index: number;
    /** The current value. */
    value: T;
    /** The total length of the array. */
    length: number;
    /** The callback function itself. */
    callback: Callback<T>;
};

/**
 * Callback invoked for each element.
 * Return a non-undefined value to short-circuit the iteration.
 *
 * @template T - The element type.
 */
type Callback<T> = (args: Argument<T>) => any;

/**
 * Signature for the synchronous each function.
 *
 * @template T - The element type.
 */
export type ArrayEach = <T>(list: T[], callback: Callback<T>) => any;

/**
 * Signature for the asynchronous each function.
 *
 * @template T - The element type.
 */
export type ArrayEachAsync = <T>(list: T[], callback: Callback<T>) => Promise<any>;

/**
 * Builds the shared parameter object for iteration.
 *
 * @template T - The element type.
 * @param list - The array to iterate.
 * @param callback - The callback function.
 * @returns A parameter object with iteration state.
 */
const getParams = <T>(list: T[], callback: Callback<T>): any => {
    return {
        value: undefined,
        index: 0,
        length: list.length,
        callback,
        result: undefined
    };
};

/**
 * Iterates over an array synchronously, invoking the callback for each element.
 *
 * If the callback returns a non-undefined value, iteration stops immediately
 * and that value is returned.
 *
 * @template T - The element type.
 * @param list - The array to iterate over.
 * @param callback - The function to invoke for each element.
 * @returns The first non-undefined return value from the callback, or `undefined`.
 */
export const arrayEach: ArrayEach = (list, callback) => {
    const params = getParams(list, callback);

    for (; params.index < params.length; params.index++) {
        params.value = list[params.index];
        params.result = callback(params);
        // Short-circuit: if the callback returns something, stop and return it
        if (params.result !== undefined) break;
    }

    return params.result;
};

/**
 * Async version of {@link arrayEach}.
 *
 * Awaits the callback for each element. Short-circuits on the first
 * non-undefined return value.
 *
 * @template T - The element type.
 * @param list - The array to iterate over.
 * @param callback - The async function to invoke for each element.
 * @returns A promise resolving to the first non-undefined callback return value.
 */
export const arrayEachAsync: ArrayEachAsync = async (list, callback) => {
    const params = getParams(list, callback);

    for (; params.index < params.length; params.index++) {
        params.value = list[params.index];
        params.result = await callback(params);
        if (params.result !== undefined) break;
    }
    return params.result;
};
