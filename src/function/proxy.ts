/**
 * Function proxy — wraps a function with a JavaScript Proxy to intercept
 * invocations (call), property access (get), and property assignment (set).
 * Useful for building chainable APIs, state wrappers, and middleware patterns.
 */

/** Arguments object provided to the proxy callback on each intercepted operation. */
type Arguments = {
    // The method that this function was called
    method: 'call' | 'get' | 'set';
    // The key that is currently called
    key: null | string;
    // Any parameter has been called
    params: any[];
};

/** Callback invoked on every intercepted proxy operation. */
type Callback = (args: Arguments) => any;

/**
 * Creates a proxied function that delegates call, get, and set operations
 * to a callback. A `throughGetQuery` flag tracks whether a property was
 * accessed (`.get`) just before invocation, so the callback can distinguish
 * between `fn()` and `fn.prop()`.
 *
 * @param callback - Receives `{ method, key, params }` for each intercepted
 *                   operation and returns the result to propagate back.
 * @returns A proxy-wrapped function. Calling it triggers `method: 'call'`,
 *          accessing a property triggers `method: 'get'`, and assigning a
 *          property triggers `method: 'set'`.
 */
export const functionProxy = (callback: Callback) => {
    let currentKey: null | string = null;

    // TODO: pending - BUG: throughGetQuery is shared across proxies created from the same functionProxy call. Should be per-proxy state
    let throughGetQuery = false;
    // Constructing the Stand in proxy function — invoked when the proxy is called as a function
    const proxyFunction = (...params: any[]) => {
        // Updating Key — only capture the key if a prior `.get` set it
        const key = throughGetQuery ? currentKey : null;
        // Return the Callback
        const result = callback({ key, method: 'call', params });
        // Reset the switch
        throughGetQuery = false;
        // Returning the Result From Callback
        return result;
    };

    // When Set Event is Triggered — intercept property assignment
    const setFunction = (target: any, key: string, value: any) =>
        callback({
            key,
            method: 'set',
            // Normalize the assigned value into an array for uniform handling
            params: Array.isArray(value) ? value : [value]
        });

    // When Get Event is Triggered — intercept property access, setting up context for a chained call
    const getFunction = (target: any, key: string) => {
        // Updating the current key
        currentKey = key;
        // Remember that it went through get Query — so the next call() knows which property was accessed
        throughGetQuery = true;
        // Updating Previous key
        return callback({ key, method: 'get', params: [] }) || target;
    };

    // Finally Return the Proxy Function
    return new Proxy(proxyFunction, {
        set: setFunction,
        get: getFunction
    });
};
