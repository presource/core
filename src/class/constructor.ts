/**
 * Class constructor lookup.
 *
 * Exposes `classConstructor`, the helper that resolves the constructor function
 * a value was built from.
 */

/** Signature: returns the constructor function of any instance. */
type ClassConstructor = <T extends new (...args: any[]) => InstanceType<T>>(instance: T) => InstanceType<T>;

/**
 * Returns the constructor function behind `instance`.
 *
 * The lookup is `Object.getPrototypeOf(instance).constructor`, so it always lands on the
 * MOST DERIVED prototype (a subclass instance reports the subclass, never the base).
 * Primitives are auto-boxed by `Object.getPrototypeOf`, so `5` yields `Number`. A class
 * value is itself a function, so `classConstructor(SomeClass)` yields `Function`.
 * `null` / `undefined` throw inside `Object.getPrototypeOf`, and a null-prototype object
 * throws when `.constructor` is read off the `null` prototype.
 *
 * @param instance - The value whose constructor is wanted.
 * @returns The constructor function (e.g. `Number`, the class, `Object`).
 */
export const classConstructor: ClassConstructor = (instance) => {
    return Object.getPrototypeOf(instance).constructor;
};
