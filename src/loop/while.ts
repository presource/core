/**
 * While-loop abstraction.
 *
 * Provides a function-driven while loop that executes a callback as long
 * as a supplied condition predicate returns `true`.  Returning a non-
 * `undefined` value from the callback is treated as a success signal and
 * immediately terminates the loop.
 */


/**
 * Argument object passed to both the condition predicate and the callback
 * on every iteration.
 *
 * @property condition - The predicate function that decides whether to continue.
 * @property callback - The function executed each iteration.
 * @property count - Zero-based iteration counter.
 * @property result - The return value from the previous callback invocation.
 */
type Argument = {
  condition: Condition;
  callback: Callback;
  count: number;
  result: any;
};

/**
 * Predicate that receives {@link Argument} and returns `true` while the
 * loop should keep running.
 *
 * @param args - The current iteration arguments.
 * @returns `true` to continue looping; `false` to stop.
 */
type Condition = (args: Argument) => boolean;

/**
 * Function invoked each iteration.
 *
 * @param args - The current iteration arguments.
 * @returns The iteration result.  Returning a non-`undefined` value signals
 *          success and immediately breaks the loop.
 */
type Callback = (args: Argument) => any;

/**
 * Execute *callback* repeatedly while *condition* returns `true`.
 *
 * On each pass the callback's return value is stored in `params.result`
 * and `params.count` is incremented.  If the callback returns a non-
 * `undefined` value the loop breaks early.
 *
 * @param condition - Predicate that returns `true` to keep looping.
 * @param callback - Function to execute each iteration.
 * @returns The final value of `params.result` after the loop ends.
 */
export const loopWhile = (condition: Condition, callback: Callback) => {
  const params: Argument = {
    condition,
    callback,
    count: 0,
    result: undefined,
  };

  while (condition(params)) {
    const result = callback(params);
    // Non-undefined return is a success signal; exit immediately
    if (result !== undefined) break;

    params.count++;
    params.result = result;
  }
  return params.result;
};
