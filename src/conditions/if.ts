/**
 * @module if
 *
 * Provides boolean-based conditional helpers. `ifTrue` triggers a callback
 * when a value is truthy; `ifFalse` triggers a callback when it is falsy.
 * Both rely on plain JavaScript truthiness (the same coercion `!!value`
 * performs) and never coerce the value they hand to the callback.
 */

/**
 * Invokes a callback when the given value coerces to boolean `true`.
 * The branch test is a plain truthiness check — equivalent to the previous
 * `isBooleanTrue(!!value)` indirection — and the callback receives the RAW value.
 *
 * @template T - The type of the value passed to the callback.
 * @param value - The value to check for truthiness.
 * @param callback - The function to invoke when value is truthy. Defaults to a no-op returning `true`.
 * @returns The result of the callback if the value is truthy, otherwise undefined.
 */
export const ifTrue = <T>(value: any, callback: (data: { value: T }) => any = () => true) => {
  // `!!value === true` is exactly `Boolean(value)`, so the truthiness check
  // below is behaviour-identical to the removed `isBooleanTrue(!!value)` call (L11).
  if (value) return callback({ value });
};

/**
 * Invokes a callback when the given value coerces to boolean `false`.
 * The branch test is a plain falsiness check — equivalent to the previous
 * `isBooleanFalse(!!value)` indirection — and the callback receives the RAW value.
 *
 * @template T - The type of the value passed to the callback.
 * @param value - The value to check for falsiness.
 * @param callback - The function to invoke when value is falsy. Defaults to a no-op returning `true`.
 * @returns The result of the callback if the value is falsy, otherwise undefined.
 */
export const ifFalse = <T>(value: any, callback: (data: { value: T }) => any = () => true) => {
  // `!!value === false` is exactly `!value`, so the falsiness check below is
  // behaviour-identical to the removed `isBooleanFalse(!!value)` call (L11).
  if (!value) return callback({ value });
};
