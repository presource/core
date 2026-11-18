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
 * @property result - Write-only in practice: only a non-breaking pass stores, and it can
 *   only store the `undefined` that let the loop continue, so a callback never sees a
 *   defined `result` (docs/issues/0004).
 * @property count - Zero-based iteration counter; increments only on passes that do NOT break.
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
 * The condition is evaluated in the `while (!condition(params))` header BELOW, so this
 * is a pre-checked loop: `loopUntil(() => true, cb)` runs the callback ZERO times.
 * It is `while (!condition)`, not `do … while (!condition)`. A non-`undefined` callback
 * return breaks the loop early (falsy values like `0`, `''` and `false` all break).
 *
 * @param condition - Predicate that returns `true` to stop looping. Checked before every
 *                    pass, including the first; a body break skips the next check.
 * @param callback - Function to execute each iteration.
 * @returns `void` — the loop never hands a value back to the caller.
 */
// TODO: pending - `loopUntil` has no `return` at all, while `loopWhile` returns
// `params.result` — which its own break-before-store ordering keeps permanently
// `undefined`. The two therefore agree in outcome and differ only in type; neither can
// hand a value back to the caller, so callers must hoist a variable outside the loop
// (docs/issues/0004).
export const loopUntil = (condition: Condition, callback: Callback) => {
  const params: Argument = {
    condition,
    callback,
    result: undefined,
    count: 0,
  };
  // Note: `!condition` makes this the logical inverse of loopWhile — and, like
  // `loopWhile`, the condition is checked BEFORE the first pass (zero-run when true).
  while (!condition(params)) {
    const result = callback(params);
    // Non-undefined return is a success signal; exit immediately. The value is dropped
    // here (never stored in `params.result`) and the function has no `return`, so it
    // cannot reach the caller.
    if (result !== undefined) break;

    // Only a continuing pass gets here, so the stored `result` is always `undefined`.
    params.count++;
    params.result = result;
  }
};
