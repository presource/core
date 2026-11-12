/**
 * Observable data list module.
 *
 * Provides a reactive wrapper around a plain object that detects property-level
 * changes and fires user-defined callbacks. This is especially useful for
 * maintaining a collection of entries that share the same internal structure,
 * where each field can have its own change handler.
 *
 * @example
 * ```ts
 * const mylist = { user1: { name: "Alice", age: 30 } };
 * const observable = dataList(mylist, { name: ({ v }) => console.log("name changed to", v) });
 * observable.user1.name = "Bob"; // logs: "name changed to Bob"
 * ```
 */

import { isFunction, isObject } from '../is';
import { objectEach, objectExtract, objectFlatten, objectObserve, objectProxy } from '../object';

/**
 * Maps each string key to a nested `Entry` describing the structure.
 *
 * @typeParam T - The shape of a single entry stored in the list.
 */
type List<T> = { [key: string]: Entry<T> };

/**
 * Recursively describes the nested property structure of a value.
 *
 * For every key of `T`, the corresponding value is itself an `Entry`,
 * allowing arbitrarily deep nesting.
 *
 * @typeParam T - The type whose keys are being described.
 */
type Entry<T> = { [key in keyof T]: Entry<T[key]> };

/**
 * A no-argument factory that returns a value of type `T`.
 *
 * Used so the returned proxy can be invoked as a function to retrieve
 * the underlying data.
 *
 * @typeParam T - The return type of the handler.
 */
type Handler<T> = () => T;

/**
 * Signature of the `dataList` factory function.
 *
 * @typeParam T - The structure template describing per-field callbacks.
 * @param list - The plain object whose properties should be observed.
 * @param structure - A template mapping field paths to callback functions.
 * @returns A proxy object that is both callable (returns the raw list)
 *          and supports property get/set on observed data.
 */
type DataList = <T extends {}>(list: { [key: string]: any }, structure: T) => any;

/**
 * Creates an observable wrapper around a plain object list.
 *
 * When a property on the returned proxy is set, the function examines the
 * `structure` template for a matching callback. If found, the callback is
 * invoked with `{ id, list, key, previous, value }` (plus short aliases).
 *
 * Object-valued assignments are flattened so that a callback fires for
 * every nested leaf property.
 *
 * @typeParam T - The structure template describing per-field callbacks.
 * @param list - The source object to wrap and observe.
 * @param structure - A template object whose leaf values are callback
 *        functions. Each key path in `structure` corresponds to a property
 *        path inside an entry of `list`.
 * @returns A dual-purpose proxy:
 *          - As a function `proxy()` returns the original `list`.
 *          - As an object, `proxy[key]` gets/sets observed data.
 */
export const dataList: DataList = (list: any, structure) => {
    // Wrap `list` with an observer that fires on every property mutation
    const observedData = objectObserve(list, ({ method, value, current, path }) => {
        // Only react to property assignments (not deletions or other operations)
        if (method === 'set') {
            // The entry key at the root of the path is the same for every leaf of
            // this assignment, so it is read once instead of per callback firing.
            // `path` is a fresh array per trap (observe.ts:86), and nothing below
            // mutates it, so this snapshot stays valid.
            const id = path[0];

            /**
             * Helper: look up the callback for a given pointer path and invoke it.
             *
             * @param key - The full dotted property path within the entry (e.g. "user1.name").
             * @param pointer - The path into the `structure` template (without the entry id).
             * @param v - The new value that was assigned.
             */
            const triggerCallback = ({ key, pointer, value: val }: any) => {
                const callback = objectExtract(structure, pointer);
                if (isFunction(callback)) {
                    const args = {
                        id,
                        list,
                        key,
                        previous: current,
                        value: val
                    };
                    callback(args);
                }
            };

            // Only a plain object value is flattened into one callback per leaf.
            // `isObject` (constructor === Object) selects exactly the nodes the old
            // `typeSwitch` sent to its `object` case: arrays, dates, class
            // instances, prototype-less objects and primitives all keep taking the
            // single-callback path, which is what makes e.g. `list.a.tags = [1,2]`
            // resolve to a non-function structure node and stay silent.
            if (isObject(value)) {
                const flattened = objectFlatten(value);
                objectEach(flattened, ({ key, value: val }: any) => {
                    const keyArray = path.slice();
                    keyArray.push(key);
                    const pointer = path.slice(1);
                    pointer.push(key);

                    triggerCallback({
                        key: keyArray.join('.'),
                        pointer: pointer.join('.'),
                        value: val
                    });
                });
            } else {
                // Primitives (and everything non-plain): trigger a single callback
                // for the property path. `slice` rather than `splice` keeps the
                // callback's `path` array un-mutated, matching the object branch
                // above; the produced pointer string is identical either way.
                triggerCallback({
                    key: path.join('.'),
                    pointer: path.slice(1).join('.'),
                    value
                });
            }
        }
    });

    /**
     * Callable handler: returns the original source list.
     *
     * This allows the proxy to be invoked as `proxy()` to retrieve
     * the raw, unproxied data. The handler is the Proxy *target*, so it only
     * has to be callable — its own return value is what `proxy(...)` yields,
     * and it accepts (and ignores) any call arguments.
     *
     * @returns The original `list` object.
     */
    const handlerFunction = () => list;

    // Build a Proxy so that the result is both callable and property-accessible
    const proxy: any = objectProxy(handlerFunction, {
        // Property read: delegate to the observed data wrapper
        get: ({ k }) => observedData[k],
        // Property write: update the observed data (which fires the change callbacks)
        set: ({ k, v }) => {
            observedData[k] = v;
        }
    });

    return proxy;
};
