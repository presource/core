/**
 * Curry utilities — converts a multi-argument function into a curried function
 * that can be called with fewer arguments, returning a new function for the
 * remaining parameters until all are provided.
 */

/**
 * Recursive type that transforms a function signature into its curried form.
 * Each curried step accepts either the first remaining argument (returning the
 * next curried step) or all remaining arguments at once (returning the final result).
 */
type Curried<F> = F extends (first: infer A, ...rest: infer Rest) => infer R
	? Rest extends []
		? F
		: ((arg: A) => Curried<(...args: Rest) => R>) | ((...args: [A, ...Rest]) => R)
	: F;

/**
 * Converts `fn` into a curried function. Each invocation accumulates arguments.
 * When the total number of provided arguments matches `fn.length` (the original
 * parameter count), the original function is executed. Otherwise, a new
 * partially-applied function is returned.
 *
 * @param fn - The function to curry.
 * @returns A curried version of `fn` that accepts arguments one or more at a time.
 */
export const functionCurry = <F extends (...args: any[]) => any>(fn: F): Curried<F> => {
    const curried = (...args: any[]): any => {
        // TODO: pending - `fn.length` ignores rest parameters and default-valued parameters, and
        // the gate below is exact equality, so a `(...rest)` target (arity 0) only fires on a
        // bare zero-argument call and an over-applied call never fires at all — such functions
        // are effectively uncurriable (docs/issues/0011, P3).
        // If not all arguments provided yet, return a new partially-applied function
        if (fn.length !== args.length) {
            return curried.bind(null, ...args);
        }
        return fn(...args);
    };
    return curried as Curried<F>;
};
