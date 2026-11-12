/**
 * Until-loop abstraction.
 *
 * Executes a callback repeatedly until a supplied condition predicate
 * returns `true`.  This is the logical inverse of {@link loopWhile}.
 * Returning a non-`undefined` value from the callback terminates the
 * loop early.
 */




/**
 * Argument object passed to both the condition predicate and the callback
 * on every iteration.
 *
 * @property condition - The predicate function that returns `true` to stop.
 * @property callback - The function executed each iteration.
 * @property result - The return value from the previous callback invocation.
 * @property count - Zero-based iteration counter.
 */
type Argument = {
  condition: Condition;
  callback: Callback;
  result: any;
  count: number;
};

/**
 * Predicate that receives {@link Argument} and returns `true` when the
 * loop should stop.
 *
 * @param args - The current iteration arguments.
 * @returns `true` to stop looping; `false` to continue.
 */
type Condition = (args: Argument) => boolean;

/**
 * Function invoked each iteration.
 *
 * @param args - The current iteration arguments.
 * @returns The iteration result.  Returning a non-`undefined` value
 *          signals success and immediately breaks the loop.
 */
type Callback = (args: Argument) => any;

/**
 * Execute *callback* repeatedly until *condition* returns `true`.
 *
 * Behaves like a `do … while (!condition)` construct: the loop body runs
 * at least once, then the condition is evaluated.  A non-`undefined`
 * callback return also breaks the loop early.
 *
 * @param condition - Predicate that returns `true` to stop looping.
 * @param callback - Function to execute each iteration.
 * @returns `void` — the loop does not return a value.
 */
// TODO: pending - Returns void while loopWhile returns params.result. Inconsistent API
export const loopUntil = (condition: Condition, callback: Callback) => {
  const params: Argument = {
    condition,
    callback,
    result: undefined,
    count: 0,
  };
  // Note: `!condition` makes this the logical inverse of loopWhile
  while (!condition(params)) {
    const result = callback(params);
    // Non-undefined return is a success signal; exit immediately
    if (result !== undefined) break;

    params.count++;
    params.result = result;
  }
};
