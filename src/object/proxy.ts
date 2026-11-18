/**
 * Object proxy utility.
 *
 * Wraps an object (or any callable target) in a JavaScript Proxy, intercepting
 * property `get` and `set` operations with custom trigger callbacks.
 *
 * Hot-path shape: the params object is only built when a trigger is actually
 * registered, so plain pass-through reads and writes pay no allocation at all.
 */

import { isInvalid } from '../is';

/** Arguments passed to proxy trigger callbacks. */
type Arguments<T> = {
    /** The property value (for `get`) or the value being assigned (for `set`). */
    value: any;
    /** The property key being accessed. */
    key: string;
    /** The underlying object being proxied. */
    object: T;
    /** The proxy trap that fired: `"get"` or `"set"`. */
    method: string;
    /** Short-hand alias for `object`. */
    o: T;
    /** Short-hand alias for `value`. */
    v: any;
    /** Short-hand alias for `key`. */
    k: string;
    /** Short-hand alias for `method`. */
    m: string;
};

/** Optional get/set interceptors for the proxy. */
type Triggers<T> = {
    /** Invoked on property read. Return a value to override the default. */
    get?: (args: Arguments<T>) => any;
    /** Invoked on property write. Return `false` to prevent the assignment. */
    set?: (args: Arguments<T>) => void | boolean;
};

/**
 * Wraps an object in a JavaScript Proxy with configurable `get` and `set` interceptors.
 *
 * @typeParam T - The type of the underlying object.
 * @param item - The object to proxy.
 * @param triggers - Optional `get`/`set` trigger callbacks.
 * @returns A Proxy instance wrapping `item`.
 */
export const objectProxy = <T extends { [key: string]: any }>(item: T, triggers: Triggers<T>): T => {
    return new Proxy(item, {
        // get trap
        get: (object: T, key: string | symbol) => {
            const strKey = key as string;
            // The get trigger is read per access (not hoisted) on purpose: the trigger
            // object stays mutable after the proxy is built, matching the previous behaviour.
            const callback = triggers.get;

            // No interceptor: behave like an ordinary read. Skipping the params object removes the
            // discarded first read as well, so an accessor property now fires once instead of twice
            // (plain data properties are unaffected, which is every in-repo consumer of this path).
            if (!callback) return object[strKey];

            const method = 'get';
            // The stored value, read before the trigger is given control
            const value = object[strKey];
            // A fresh params object per access: a trigger may retain it, so it must never be
            // reused between accesses (deferred contract change)
            const params: any = {
                key: strKey,
                value,
                object,
                method,
                // Short aliases for the same four entries, so a trigger can destructure either spelling
                k: strKey,
                v: value,
                o: object,
                m: method
            };

            // Whatever the trigger returns is what the caller reads — it may hand back a wrapped or
            // derived value instead of the raw `value` above
            return callback(params);
        },

        // set trap
        set: (object: T, key: string | symbol, value: any) => {
            const strKey = key as string;
            // The set trigger is read per access for the same reason as in the `get` trap above
            const callback = triggers.set;

            // If no callback for set is set then do the ordinary assignment, with no params object
            if (!callback) {
                (object as any)[strKey] = value;
                return true;
            }

            const method = 'set';
            // Fresh params per access, same contract as in the `get` trap above
            const params: any = {
                key: strKey,
                value,
                object,
                method,

                k: strKey,
                v: value,
                o: object,
                m: method
            };

            // Run the trigger; its return value decides whether the write is accepted
            const result = callback(params);
            // A nullish callback result means "no opinion", so the assignment proceeds (true).
            // Anything the callback returns explicitly is used as-is, which is how a trigger
            // can veto the write by returning `false`.
            return isInvalid(result) ? (true as any) : result;
        }
    });
};
