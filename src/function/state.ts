/**
 * Function state management system inspired by React's useState, but designed
 * around functions. Tracks state values, detects changes, and propagates updates
 * through a dependency chain so that dependent functions re-execute automatically.
 */

import { objectEach } from '../object';
import { stringSwitch } from '../string';
import { typeSwitch } from '../type';
import { functionProxy } from './proxy';

/** Configuration object for the function state (extensible, currently unused). */
type Setting = {};
/** A generic callback that accepts any parameters and returns any value. */
type Callback = (...params: any[]) => any;
/** Wrapper that accepts an initial value or function and returns a state accessor. */
type Wrapper = (callback: Callback | string | number | boolean) => any;

/**
 * Creates a function-based state management system. Each call to the returned
 * wrapper registers a new state slot. When a state function is invoked via
 * `functionProxy`, it tracks which other state slots were read (dependencies).
 * If the state value changes, all dependents are automatically re-triggered
 * through the `chained` sets, enabling reactive updates.
 *
 * @param setting - Optional configuration object for the state group (reserved for future use).
 * @returns A wrapper function. Each invocation of the wrapper registers a new state
 *          slot and returns a proxied state accessor function.
 */
export const functionState = (setting: Setting = {}): Wrapper => {
    // The recorded value list
    const values: any[] = [];
    // The State function
    const state: any[] = [];
    // The Trigger List
    const triggers: any[] = [];
    // Record of Triggers — increments a counter for the given state index inside
    // the most recent trigger record on the stack, so dependents can be tracked.
    const triggered = (index: number) => {
        // Save Trigger Records
        if (triggers.length) {
            const triggerIndex = triggers.length - 1;
            // The stack only ever holds arrays: every entry is pushed as a fresh `[]`
            // (see the `function` case below) and re-assigned from this branch. With the
            // `triggers.length` guard above, `triggers[triggerIndex]` is therefore always
            // a truthy array, so the previous `|| {}` fallback was unreachable dead code
            // (one of the package's uncovered branches) and has been removed.
            const trigger = triggers[triggerIndex];
            // Incrementing Trigger by one.
            trigger[index] = (trigger[index] || 0) + 1;
            triggers[triggerIndex] = trigger;
        }
    };

    // Chained Reaction — each entry holds a Set of dependent state indices
    const chained: any[] = [];
    // Propagate up the chain of command — when a state value changes, notify all dependents
    const propagate = (index: number, value: any) => {
        // If new value is different than previous value
        if (values[index] !== value) {
            // Overwriting Old Value
            values[index] = value;
            // Triggering Callback — re-invoke each dependent state to refresh
            chained[index].forEach((callback: any) => {
                // Triggering the data updater by index
                state[callback]?.();
            });
        }
    };

    // Return the Wrapper to Add Input
    return (input: any) => {
        // Getting the Index
        const index = values.length;
        // Creating a New Set for Chaining
        chained[index] = new Set();
        // Creating a Callback Function — handles both function and plain-value inputs
        const callback = typeSwitch(input, {
            // If value is a function — wrap it to capture dependency reads during execution
            // TODO: pending - Async state slots are unimplemented. An async callback is
            // wrapped like any other function, so its value is a fresh Promise on every run
            // and `propagate` (reference-equality gate) sees a change every time. The block
            // below is that unimplemented design; it also predates the current `{ key }`
            // payload of `objectEach` (it destructures `{ k }`), so it cannot just be
            // uncommented. The matching async example in src/function/state.test.ts is
            // commented out for the same reason (docs/issues/0011, P2).
            function: ({ value }: any) => {
                // // If the Function is Async, return an async wrapper that awaits the
                // // result between the trigger push and the dependent-chain collection.
                // if (isFunctionAsync(value)) {
                //   return async (...params: any[]) => {
                //     triggers.push([]);
                //     // Async. Await
                //     const result = await value();
                //     // Get the list of dependent and add to chain
                //     objectEach(triggers.pop(), ({ k }: any) => {
                //       // Adding current function into Chain
                //       chained[k].add(index);
                //     });
                //     // Returning the Result
                //     return result;
                //   };
                // }

                return (...params: any[]) => {
                    // Adding Trigger Recorder — push a fresh trigger record onto the stack
                    triggers.push([]);
                    // Passing in the parameters
                    const result = value();
                    // Get the list of dependent and add to chain — pop the trigger record,
                    // then register the current state index as a dependent of each read slot.
                    objectEach(triggers.pop(), ({ key }: any) => {
                        // Adding current function into Chain
                        chained[key].add(index);
                    });
                    // Returning the Result
                    return result;
                };
            },
            // Triggering by Default — for non-function values, create a getter/setter
            default: ({ value }) => {
                // Store the initial value
                values[index] = value;
                // Return a callback function
                return (value?: any) => {
                    // If value is undefined, return the data value — `undefined` is a read
                    if (value === undefined) return values[index];
                    // A defined argument is a write: hand it back so the proxy's `call`
                    // handler feeds it to `propagate`, which stores it and re-runs dependents.
                    return value;
                };
            }
        });

        // First time trigger, stored the first values — for a function slot this run also
        // registers the slot's dependencies; reading the slot again re-runs the function.
        values[index] = callback();

        // The State Wrapper Function — a proxy that intercepts calls to track triggers and propagate changes
        state[index] = functionProxy(({ method, params }) => {
            // Return whatever data is triggered
            return stringSwitch(method, {
                // Only `call` has a case; `get`/`set` are handled by `functionProxy` itself,
                // and its get trap leaks the raw target for unknown properties (pinned in
                // src/function/state.test.ts, 'exposes the raw target function for property access on a slot').
                call: () => {
                    // Triggered — record that this state was accessed
                    triggered(index);
                    // Run the slot callback with the call arguments (function slots ignore
                    // them and re-evaluate on every read)
                    const response = callback(...params);
                    // Propagate up the chain — notify dependents if value changed
                    propagate(index, response);
                    // Return the stored value, not the raw response: `propagate` only writes
                    // when the value actually changed, so this is the accepted state value.
                    return values[index];
                }
            });
        });
        // Return the State Function
        return state[index];
    };
};
