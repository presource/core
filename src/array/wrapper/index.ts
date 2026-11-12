/**
 * Array wrapper module.
 *
 * Provides a proxy-based wrapper around arrays that adds chainable
 * methods for filtering, iteration, selection, and inspection.
 * Prefer direct array utilities for performance-critical code.
 */

import { isInvalid } from '../../is';
import { objectProxy } from '../../object';
import { countFunction } from './methods/count';
import { eachFunction } from './methods/each';
import { getFunction } from './methods/get';
import { isFunction } from './methods/is';
import { keysFunction } from './methods/keys';
import { removeFunction } from './methods/remove';
import { retainFunction } from './methods/retain';
import { selectFunction } from './methods/select';
import { randomFunction } from './methods/random';

/**
 * Parameter object passed to every wrapper method.
 *
 * Contains the wrapper factory, the underlying array element, filter config,
 * and the proxy instance. Shorthand aliases (w, e, c, i) are also provided.
 */
export type Params = {
    /** The wrapper factory function used to create new wrapper instances. */
    wrapper: WrapperFunction<{}>;
    /** The underlying array being wrapped. */
    element: any[];
    /** Configuration object containing filter predicates. */
    config: { filter: ((data: any, params: Params) => boolean)[] };
    /** The proxy instance for method chaining. */
    instance: Returned<{}>;

    /** Short alias for `wrapper`. */
    w: WrapperFunction<{}>;
    /** Short alias for `element`. */
    e: any[];
    /** Short alias for `config`. */
    c: { [key: string]: any };
    /** Short alias for `instance`. */
    i: Returned<{}>;
};

/**
 * A map of custom method names to their handler functions.
 * Keys are method names; values are functions that receive a Params object
 * augmented with an `args` array and return any value.
 */
type ExtendList<T extends ExtendList<T>> = { [key: string]: ExtendFunction<T> };

/**
 * A custom extension method handler.
 * Receives the wrapper params plus the arguments passed at call time.
 */
type ExtendFunction<T extends ExtendList<T>> = (params: Params & { args: any[] }) => any;

/**
 * The factory function produced by `arrayWrapper`.
 * Accepts an array and optional config, and returns a proxied wrapper instance.
 */
type WrapperFunction<T extends ExtendList<T>> = (element: any[], config?: Params['config']) => Returned<T>;

/**
 * The return type of a wrapper instance.
 *
 * Combines dynamic extension methods (from generic T) with the built-in
 * wrapper methods: get, keys, is, count, random, each, remove, select, retain.
 */
type Returned<T extends ExtendList<T>> = {
    // Dynamic methods from extension map T
    [key in keyof T]: {
        (): Returned<T>;
        (...args: any[]): any;
    };
} & {
    /** Invoke the wrapper to extract the underlying array. */
    (): any;
    /** Count matching elements, optionally filtered by type. */
    count: (request?: Parameters<typeof countFunction>[1]) => number;
    /** Get matching elements, optionally filtered by criteria. */
    get: (request?: Parameters<typeof getFunction>[1]) => any[];
    /** Get matching indexes, optionally filtered by criteria. */
    keys: (request?: Parameters<typeof keysFunction>[1]) => number[];
    /** Check if the wrapped array satisfies a condition. */
    is: (check?: Parameters<typeof isFunction>[1]) => boolean;
    /** Return a random element from the wrapped array. */
    random: () => any;

    /** Chaining methods — return a new wrapper for further operations. */
    each: (callback: Parameters<typeof eachFunction>[1]) => Returned<T>;
    remove: (request?: Parameters<typeof removeFunction>[1]) => Returned<T>;
    select: (request: Parameters<typeof selectFunction>[1]) => Returned<T>;
    retain: (request: Parameters<typeof retainFunction>[1]) => Returned<T>;
};

/**
 * The signature of the `arrayWrapper` factory.
 * Accepts an optional extension method map and returns a wrapper factory function.
 */
type Structure = (callbacks?: any) => (element: any[], config?: any) => any;

/**
 * Creates an array wrapper factory with optional custom extension methods.
 *
 * The returned factory accepts an array and returns a proxy object with
 * chainable methods for querying, filtering, and mutating the underlying array.
 *
 * @param callbacks - Optional map of custom method names to handler functions.
 * @returns A wrapper factory that produces proxy-backed wrapper instances.
 */
export const arrayWrapper: Structure = (callbacks: any = {}) => {
    const wrapper = (element: any[], config = {}) => {
        // Placeholder handler for advanced usage (not yet implemented)
        const handler = () => {
            return null;
        };

        // Create a proxy that intercepts property access to expose wrapper methods
        const instance = objectProxy(handler, {
            get: ({ k }) => {
                // Build the params object shared across all method calls
                const params: any = {
                    wrapper,
                    element,
                    config,
                    instance
                };

                // Built-in wrapper methods mapped to their implementations
                const available: any = {
                    get: (request: any) => getFunction(params, request),
                    keys: (request: any) => keysFunction(params, request),
                    is: (request: any) => isFunction(params, request),
                    count: (request: any) => countFunction(params, request),
                    select: (request: any) => selectFunction(params, request),
                    each: (callback: any) => eachFunction(params, callback),
                    random: () => randomFunction(params),
                    remove: (request: any) => removeFunction(params, request),
                    retain: (callback: any) => retainFunction(params, callback)
                };

                // If a custom extension callback exists for this key, wrap it
                const extendedCallback = callbacks[k];
                if (extendedCallback) {
                    return (...args: any[]) => {
                        const value = extendedCallback({ ...params, args });
                        // If the callback returns a valid value, return it; otherwise return the instance for chaining
                        if (!isInvalid(value)) return value;
                        return instance;
                    };
                }

                return available[k];
            }
        });

        return instance;
    };

    return wrapper;
};
