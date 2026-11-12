/**
 * @module then
 *
 * Provides a recursive if-then conditional construct. The condition receives
 * the callback and can decide whether to invoke it. The callback receives the
 * condition, enabling nested or recursive if-then chains.
 */

/**
 * A Condition evaluates a predicate and returns a boolean.
 * It receives the associated callback so it can inspect or defer execution.
 */
type Condition = (args: { callback: Callback }) => boolean;

/**
 * A Callback is invoked when the condition evaluates to true.
 * It receives the condition, allowing recursive or nested if-then logic.
 */
type Callback = (args: { condition: Condition }) => any;

/**
 * Evaluates a condition and, if true, invokes the associated callback.
 * The condition receives the callback and the callback receives the condition,
 * enabling recursive or chained if-then constructs.
 *
 * @param condition - A predicate function that receives the callback and returns a boolean.
 * @param callback - A function invoked when the condition is truthy; receives the condition for nesting.
 * @returns The result of the callback if the condition is true, otherwise undefined.
 */
export const ifThen = (condition: Condition, callback: Callback) => {
  // The condition is given the callback; if truthy, the callback fires with the
  // condition (enabling recursion).
  //
  // PERF (L11): every argument object is allocated only at the moment it is consumed, so a
  // falsy condition allocates exactly ONE object — the callback's `{ condition }` record is
  // never built — and the truthy path allocates one per side, immediately before use. A
  // single shared mutable record for both sides was considered and rejected: callers observe
  // each payload's identity and own keys, so merging them would be observable (pinned in
  // src/conditions/then.test.ts, 'each side is handed exactly one argument containing the
  // other function').
  //
  // NOTE: the previous one-liner `if (condition({ callback })) return callback({ condition })`
  // already allocated lazily, so this guard-clause form is a clarity change with no
  // measurable allocation win — the remaining `{ callback }` object cannot be removed
  // without breaking the documented injection contract.
  if (!condition({ callback })) return;
  return callback({ condition });
};
