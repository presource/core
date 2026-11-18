/**
 * Function proxy — wraps a function with a JavaScript Proxy to intercept
 * invocations (call), property access (get), and property assignment (set).
 * Useful for building chainable APIs, state wrappers, and middleware patterns.
 */

/** Arguments object provided to the proxy callback on each intercepted operation. */
type Arguments = {
    // Which operation was intercepted: invoke, property read, or property write
    method: 'call' | 'get' | 'set';
    // The property key involved — `null` for a bare call with no preceding `.property` read
    key: null | string;
    // Call args for `call`; for `set` the value as an array (arrays pass through as-is); empty for `get`
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

    // TODO: pending - `throughGetQuery` / `currentKey` live in this factory closure and are
    // only cleared when the proxy is CALLED, so a property read used for a non-call purpose
    // leaves the flag set and the next bare call is reported with that stale key (pinned in
    // src/function/proxy.test.ts, "a property read without a call leaves the key for the
    // next call"). Each `functionProxy` call owns its own pair — see the sibling test
    // "each functionProxy call owns its own key state" (docs/issues/0011, P3).
    let throughGetQuery = false;
    // Stand-in proxy function — the Proxy target, invoked when the proxy is called as a function
    const proxyFunction = (...params: any[]) => {
        // Only report a key when the call directly follows a `.property` read on this proxy
        const key = throughGetQuery ? currentKey : null;
        // Return the Callback
        const result = callback({ key, method: 'call', params });
        // Reset the switch — this is the ONLY place the flag is cleared
        throughGetQuery = false;
        // Returning the Result From Callback
        return result;
    };

    // When Set Event is Triggered — intercept property assignment
    const setFunction = (target: any, key: string, value: any) =>
        callback({
            key,
            method: 'set',
            // Uniform array form: an existing array passes through by reference, else wrapped
            params: Array.isArray(value) ? value : [value]
        });

    // When Get Event is Triggered — intercept property access, setting up context for a chained call
    const getFunction = (target: any, key: string) => {
        // Updating the current key
        currentKey = key;
        // Remember that it went through get Query — so the next call() knows which property was accessed
        throughGetQuery = true;
        // A truthy callback result becomes the property's value; a falsy one leaks the
        // RAW unproxied target (`target`), which is still callable but not the proxy.
        return callback({ key, method: 'get', params: [] }) || target;
    };

    // Finally Return the Proxy Function
    return new Proxy(proxyFunction, {
        set: setFunction,
        get: getFunction
    });
};
