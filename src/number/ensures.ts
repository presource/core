/**
 * Coerces any value into a valid number.
 *
 * Applies unary `+` to the value and returns 0 for falsy inputs,
 * or when the result is `NaN`.
 *
 * @param value - The value to coerce to a number.
 * @returns The coerced number, or 0 if the value is falsy or not a valid number.
 */
export const numberEnsures = (value: any): number => {
  const result = value ? +value : 0;
  // Must be a number, otherwise returns 0
  return isNaN(result) ? 0 : result;
};
