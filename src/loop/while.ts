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
 * @property count - Zero-based iteration counter; increments only on passes that do NOT break.
 * @property result - Write-only in practice: only a non-breaking pass stores, and it can
 *   only store the `undefined` that let the loop continue, so a callback never sees a
 *   defined `result` (docs/issues/0004).
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
 * The condition gates the very first pass, so a false condition runs the body ZERO
 * times. On a non-breaking pass `params.count` is incremented and `params.result` is
 * stored. A breaking pass (any non-`undefined` return, including falsy `0` / `''` /
 * `false`) exits BEFORE that store, so its value is never recorded.
 *
 * @param condition - Predicate that returns `true` to keep looping. Checked once per
 *                    pass plus one final failing check when the loop ends normally.
 * @param callback - Function to execute each iteration.
 * @returns `params.result` — effectively ALWAYS `undefined`: a stored value is always
 *          `undefined`, and the break path stores nothing (docs/issues/0004).
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
    // Non-undefined return is a success signal; exit immediately — WITHOUT storing the
    // value below, which is why the break value can never be returned.
    if (result !== undefined) break;

    // Only a continuing pass reaches the bookkeeping, so `result` is always `undefined`.
    params.count++;
    params.result = result;
  }
  return params.result;
};
