/**
 * Function options — builds an extensible, composable options object. Calling the
 * handler with a new options object merges and extends the set of available methods.
 * Calling with no arguments returns `{ reset, update }` controls. Supports parent
 * inheritance so child option sets can fall back to parent methods.
 */

import { typeSwitch } from '../type';
import { objectProxy } from '../object';

/** Map of named async functions that make up the options interface. */
type CallbackFunction = { [key: string]: (...inputs: any[]) => Promise<any> };

/**
 * Callable handler type. When invoked with a `newOptions` object, it returns an
 * extended handler. When invoked with no arguments, it returns management controls.
 */
type Handler<Options> = Options & {
    <NewOptions extends CallbackFunction>(newOptions: NewOptions): Handler<Options & NewOptions>;
    (): {
        reset: () => void;
        update: (newOptions: CallbackFunction) => void;
    };
};

/** Factory signature that creates a typed handler from an options object and optional parent. */
export type FunctionOptions = <Options extends CallbackFunction>(
    options: Options,
    parent?: FunctionOptions
) => Handler<Options>;

/**
 * Creates a composable options handler. The returned object acts as both a callable
 * (to extend or manage options) and as a proxy that resolves methods from the current
 * options set or falls back to a parent options set.
 *
 * @param options - The initial set of named async functions.
 * @param parent - An optional parent `FunctionOptions` handler to inherit from
 *                  when a method isn't found on the current handler.
 * @returns A handler that can be called with a new options object to extend,
 *          called with no arguments to get `{ reset, update }`, or accessed
 *          directly for method resolution (with parent fallback).
 */
export const functionOptions: FunctionOptions = (options, parents?: FunctionOptions) => {
    // The raw handler: called with an object to extend, or with no args for management
    const handler = ((input?: CallbackFunction) => {
        return typeSwitch(input, {
            // Extending: create a child options handler with the new options, inheriting from the current one
            object: ({ value: newOptions }) => {
                return functionOptions(newOptions, functionOptionsObject);
            },
            // Management: return reset/update controls
            default: () => {
                return {
                    reset: () => {
                        Object.assign(handler, options);
                    },
                    update: (newOptions: CallbackFunction) => {
                        Object.assign(handler, newOptions);
                    }
                };
            }
        });
    }) as Handler<typeof options>;

    // PERF (L13): seed the handler with a direct `Object.assign` — this is exactly what
    // the old `handler().reset()` did, but without the detour through `typeSwitch`
    // (which builds an args object plus one nested-helper closure per case key) and
    // without allocating the throwaway `{ reset, update }` control and its two closures.
    //
    // PINNED CONTRACT (do not "fix"): the assignment still runs here, at construction
    // time and before the proxy is created, so an option key that collides with an own
    // non-writable property of the function object (`name`, `length`) throws a
    // `TypeError` out of `Object.assign`'s [[Set]] in strict-mode module code. Keys such
    // as `call` / `apply` / `constructor` / `prototype` are inherited or absent, so they
    // become plain own properties and do not throw. Pinned in src/function/options.test.ts.
    Object.assign(handler, options);

    // Wrap with an object proxy to resolve methods from current or parent handler
    const functionOptionsObject = objectProxy(handler, {
        get: ({ object: currentObject, key }) => {
            const currentMethod = currentObject[key];
            if (currentMethod) {
                return currentMethod;
            }

            // Fallback to parent method if not found locally
            const parentMethod = (parents as any)?.[key];
            if (parentMethod) {
                return parentMethod;
            }
        }
    }) as any;

    return functionOptionsObject;
};
