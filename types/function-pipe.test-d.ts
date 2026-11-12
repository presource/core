import { test, expectTypeOf } from 'vitest';

import { functionPipe } from '@presource/core';

/**
 * Type-level contract for `functionPipe` (src/function/pipe.ts).
 *
 * The returned function is always `(value: <input of the FIRST fn>, ...args: any[]) => PipeReturn<T>`,
 * and `PipeReturn<T>` (module-private) only terminates when the tuple has a single function
 * (`Rest extends []` -> `ReturnType<First>`). Verified with tsc 6.0.2:
 * - 1 function  -> exact input AND output types;
 * - >= 2 functions -> the recursion re-injects a head function without consuming `Rest`, so the
 *   conditional never settles: tsc raises TS2589 ("excessively deep") on the first statement
 *   that needs the return type and falls back to `any`;
 * - 0 functions -> `value: any` (there is no `T[0]` to infer an input from) and
 *   `PipeReturn<[]>` = `never`, even though the runtime identity pipe returns the seed;
 * - extra call arguments are forwarded to step 0 only and are typed as an `any` rest tuple.
 *
 * NOTE on the `@ts-expect-error` placement below: TS defers the non-terminating conditional, so
 * the error is reported on the FIRST use of the degraded type. That first use is therefore the
 * line carrying the directive, and every assertion after it is checked normally (the instantia-
 * tion is cached, so it no longer errors). If `PipeReturn` is ever fixed the directive becomes
 * unused and this file fails loudly.
 */

test('a single-function pipe keeps the exact input and output types', () => {
    const pipe = functionPipe((x: number) => x + 1);
    expectTypeOf(pipe).toEqualTypeOf<(value: number, ...args: any[]) => number>();
    expectTypeOf(pipe(1)).toBeNumber();
    // Extra arguments exist in the signature even though downstream steps never receive them.
    expectTypeOf(pipe).parameters.toEqualTypeOf<[value: number, ...args: any[]]>();
});

test('a two-function pipe infers the first input but degrades the output to any', () => {
    const pipe = functionPipe((x: number) => x + 1, (s: string) => s.length);
    // @ts-expect-error TS2589: `PipeReturn<[(x: number) => number, (s: string) => number]>` never terminates, so tsc reports the degradation here
    expectTypeOf(pipe).toEqualTypeOf<(value: number, ...args: any[]) => any>();
    // Assertions below run on the cached (degraded) instantiation and are checked normally.
    expectTypeOf(pipe).parameter(0).toBeNumber();
    expectTypeOf(pipe(1)).toBeAny();
    expectTypeOf(pipe(1, 'extra', true)).toBeAny();
});

test('a three-function pipe behaves exactly like the two-function pipe', () => {
    const pipe = functionPipe((x: number) => `${x}`, (s: string) => s.length, (n: number) => n > 0);
    // @ts-expect-error TS2589: the same non-terminating `PipeReturn` recursion, reported on the first use
    expectTypeOf(pipe).parameter(0).toBeNumber();
    // The input type still comes from the first step (`T[0] extends (v: infer I) => any`),
    // while the output type is gone.
    expectTypeOf(pipe(1)).toBeAny();
});

test('an empty pipe types the value as any and the result as never', () => {
    const pipe = functionPipe();
    expectTypeOf(pipe).toEqualTypeOf<(value: any, ...args: any[]) => never>();
    // Runtime returns the seed untouched (`reduce` over an empty array), the type says never.
    expectTypeOf(pipe(7)).toBeNever();
});

test('the first-step input type is inferred from a contextual value, not from later steps', () => {
    // Step 1 takes a `string`; step 2 takes a `number`. The piped input stays `string`.
    const pipe = functionPipe((s: string) => s.length, (n: number) => n > 0);
    // @ts-expect-error TS2589: same degradation (first use of the return type)
    expectTypeOf(pipe).parameter(0).toBeString();
    expectTypeOf(pipe('abc')).toBeAny();
    // Passing the wrong input type is still a hard error even though the output is `any`.
    // @ts-expect-error TS2345: the pipe expects the first function's input (`string`)
    pipe(42);
});
