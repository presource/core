/**
 * Function pipe — composes functions left-to-right, passing the output of each
 * function as the input to the next. The first function also receives any
 * additional arguments, matching the signature of `pipe(f, g, h)(value, ...args)`.
 */

/**
 * Recursively computes the return type of piping through a tuple of functions.
 * Each function's return type becomes the input type of the next function.
 */
type PipeReturn<T extends ((...args: any[]) => any)[]> = T extends [
	infer First,
	...infer Rest,
]
	? First extends (...args: any[]) => any
		? Rest extends ((...args: any[]) => any)[]
			? Rest extends []
				? ReturnType<First>
				: PipeReturn<[(...args: ReturnType<First>[]) => any, ...Rest]>
			: ReturnType<First>
		: never
	: never;

/**
 * Returns a new function that pipes `value` through `fns` in order.
 * The first function receives `(value, ...args)` so extra arguments are
 * forwarded only to the first step, not to downstream functions.
 *
 * @param fns - One or more functions to pipe through, in execution order.
 * @returns A function that accepts an initial `value` and optional extra `args`,
 *          then returns the result of passing `value` through all functions sequentially.
 */
export const functionPipe = <T extends ((...args: any[]) => any)[]>(
	...fns: T
) => {
	return (value: T[0] extends (v: infer I, ...args: any[]) => any ? I : any, ...args: any[]) => {
		// PERF (L12): step 0 is hoisted out of the fold, so the loop body no longer
		// evaluates the `i === 0` discriminator and no `reduce` callback closure is
		// allocated per pipe invocation. Semantics are identical to the previous
		// `fns.reduce((v, f, i) => (i === 0 ? f(v, ...args) : f(v)), value)`:
		//   - no functions       -> the seed `value` is returned verbatim (identity)
		//   - step 0             -> receives `(value, ...args)`; extra args stop here
		//   - steps 1..n         -> receive only the accumulated value
		//   - a throwing step    -> propagates immediately and skips downstream steps
		// Widened view of the tuple so it can be indexed with a running counter.
		const steps = fns as ((...args: any[]) => any)[];
		let result = steps.length ? steps[0](value, ...args) : value;
		for (let index = 1; index < steps.length; index++) {
			result = steps[index](result);
		}
		return result as PipeReturn<T>;
	};
};
