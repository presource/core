/**
 * Object update utility.
 *
 * Overwrites properties on a target object with key-value pairs from a source object.
 */

/**
 * Updates an object by overwriting its properties with those from another object.
 *
 * Assigns every own enumerable key of `update` directly onto `object`.
 * Mutates the original object and returns it for chaining.
 *
 * @param object - The target object to update.
 * @param update - The object whose properties will overwrite the target.
 * @returns The mutated `object` for method chaining.
 */
export const objectUpdate = (object: any, update: any): typeof object => {
  // `Object.assign` performs the same own-enumerable-key overwrite the `objectEach` walk did,
  // but roughly twice as fast (Temp/coding-perf), and this helper sits on many hot paths.
  // Three deliberate differences from the previous walk:
  //   1. symbol keys are now copied as well (Object.keys skipped them);
  //   2. a null/undefined source is silently ignored by Object.assign, so the guard below
  //      keeps the original `TypeError: Cannot convert undefined or null to object` that
  //      `Object.keys(update)` used to raise for every caller.
  //   3. a primitive target is now silently left unchanged instead of throwing: the previous
  //      per-key assignment hit `TypeError: Cannot create property 'a' on string 'abc'` on a
  //      strict-mode receiver, while `Object.assign` boxes the target internally and discards
  //      the write (pinned in src/object/update.test.ts).
  if (update === null || update === undefined) Object.keys(update);

  // Update or overwrite existing values
  Object.assign(object, update);
  // Return the original reference for future chaining (Object.assign returns the boxed
  // wrapper for a primitive target, so `object` is returned explicitly)
  return object;
};
