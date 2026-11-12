/**
 * Function chain — builds a chainable fluent API where property access (`.prop`)
 * and invocations (`()`) are tracked as a sequence. A callback receives the
 * accumulated chain, current index, key, and arguments on each step, enabling
 * custom DSL or routing logic.
 */

import { stringSwitch } from '../string';
import { functionProxy } from './proxy';

/** Data object passed to the user callback on each chain step. */
type Data = {
    // Chain String Array — the sequence of property keys accessed so far
    chain: string[];
    // The current key — the most recently accessed property name
    key: null | string;
    // The index in the chain — incremented on each property access
    index: number;
    // The parameter that was passed — arguments from the invocation
    params: any[];
};

// The That Pass into Callback
type Callback = (data: Data) => any;

/** Return type: both callable and indexable to support fluent chaining. */
type ReturnFunction = {
    (...input: any[]): ReturnFunction;
    [key: string]: ReturnFunction;
};

/** Factory that creates a chainable function from a callback. */
type FunctionChain = (callback: Callback) => ReturnFunction;

/**
 * Creates a chainable function that tracks a sequence of property accesses and
 * invocations. Each `.property` access increments the index and records the key.
 * Each invocation pushes the key onto `chain` and fires the callback. A `pending`
 * mechanism ensures callbacks fire even when `.property` is accessed without an
 * immediate following call, as long as the index changes.
 *
 * @param callback - Receives `{ chain, index, key, params }` on each chain step.
 *                   Returning a truthy value breaks the chain; returning falsy
 *                   continues chaining.
 * @returns A chainable function. Call it directly to start/reset a chain, or
 *          access properties (`.foo`) to build a chain.
 */
export const functionChain: FunctionChain = (callback) => {
    // The Chain Memory — tracks the sequence of accessed keys
    let chain: string[] = [];
    // The Initial Index — incremented on each property access to track depth
    let index = 0;
    // The Key String — the most recently accessed property name
    let key: null | string = null;
    // This is the pending caller — holds a deferred callback if `.get` fired
    // without a subsequent `.call`, so the callback can still be triggered.
    let pending: any = null;

    // This is to reset all the parameters — used when the root function is called to start fresh
    const reset = () => {
        chain = [];
        index = 0;
        key = null;
    };

    // Building the Chain Function from the Function Proxy — intercepts both calls and property access
    const chainFunction = functionProxy((data) => {
        // Checking the configurations
        return stringSwitch(data.method, {
            // if method is called — the proxy function is invoked
            call: () => {
                // Extracting the parameters
                const params = data.params;

                if (data.key === null) {
                    // The Root function is called — no preceding property access, so hard reset
                    reset();
                } else {
                    // Adding to Chain List — a property was accessed before the call
                    chain.push(key!);
                }

                // If there is a pending deferred callback from a prior `.get`, and the
                // index has advanced, fire the pending callback so the user gets the intermediate state.
                if (pending && index !== pending.index) {
                    // Trigger only if index and pendingIndex is different
                    pending.callback(params);
                    // Else Triggering the result
                }

                // Passing the parameter — fire the user callback with current chain state
                const result = callback({ chain, index, key, params });
                // Clearing the Pending List
                pending = null;
                // Return the Result or chainfunction for further chaining — falsy result continues the chain
                return result || chainFunction;
            },
            // if method is get — a property is being accessed (e.g., `.foo`)
            get: () => {
                // if get method, always increment index by 1 — tracks depth in the chain
                index++;
                // remember to set data key
                key = data.key;

                // If there is Pending. Call it! — fire any deferred callback from the previous get
                // TODO: pending - pending.callback() called with no args on .get, but called with params elsewhere
                if (pending) pending.callback();

                // Constructing a pending caller — stored in case the next operation is another `.get`
                // rather than a call, so the callback still fires when the index changes.
                pending = {
                    callback: (...params: any[]) => callback({ chain, index: pending.index, key: pending.key, params }),
                    index,
                    key
                };
                // Returning the Callback — always return the chain function for further chaining
                return chainFunction;
            }
        });
    });

    // Returnin the Chain Function
    return chainFunction as ReturnFunction;
};
