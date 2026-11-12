/**
 * Function control — creates a callable proxy object where property access
 * delegates to a user-supplied callback. Useful for building DSLs or
 * configuration objects that react to property reads.
 */

import { objectProxy } from '../object';

/** Callback signature: receives the accessed key and an optional value. */
type Callback = (input: { key: string; value?: any }) => any;

/**
 * Built-in function metadata names that must NOT be routed through the callback.
 * Hoisted to module scope as a Set so the `get` trap performs a single O(1)
 * `has` lookup instead of allocating and linearly scanning a fresh array
 * literal on every property read (M13). `Set.prototype.has` uses the same
 * SameValueZero comparison as `Array.prototype.includes`, so symbol keys and
 * every other value resolve exactly as before.
 */
const EXCLUDED_KEYS = new Set(['name', 'prototype', 'displayName']);

/**
 * Factory type: given a callback, returns a callable object whose property
 * accesses are routed through the callback.
 */
export type FunctionControl = (callback: Callback) => any;

/**
 * Creates a controlled callable object backed by a proxy. Accessing any property
 * on the returned object triggers `callback({ key })`. Calling the object as a
 * function triggers `callback({})`. Built-in function properties like `name`,
 * `prototype`, and `displayName` are excluded from interception.
 *
 * @param callback - Receives `{ key, value? }` on each property access or invocation.
 * @returns A callable proxy object that delegates property reads and calls to `callback`.
 */
export const functionControl: FunctionControl = (callback: any) => {
    // This is the primary handler function — invoked when the object is called as a function
    const handlerFunction = () => {
        return callback({});
    };

    // Wrapped around the object proxy to intercept property access
    return objectProxy(handlerFunction, {
        // Ensuring get is correctly — route property reads through the callback
        get: ({ key }) => {
            // Skip intercepting standard function metadata properties
            // TODO: pending - Hard-coded excluded properties ['name','prototype','displayName']. Not configurable
            if (EXCLUDED_KEYS.has(key)) {
                return;
            }
            return callback({ key });
        }
    });
};
