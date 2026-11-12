import { test, expectTypeOf } from 'vitest';

import { functionCurry } from '@presource/core';

/**
 * Type-level contract for `functionCurry` (src/function/curry.ts).
 *
 * `Curried<F>` (module-private) rewrites `(a: A, ...rest: Rest) => R` as:
 *   Rest extends [] ? F
 *                   : ((arg: A) => Curried<(...rest: Rest) => R>) | ((...args: [A, ...Rest]) => R)
 * Everything below is the behaviour tsc 6.0.2 actually produces, verified with the
 * compiler API before being pinned:
 * - 0- and 1-parameter signatures hit the `Rest extends []` branch and come back unchanged;
 * - signatures with >= 2 parameters stay a UNION of two call signatures;
 * - calling a union of signatures uses the widest arity, so the runtime-legal partial call
 *   `curried(a)` is a tsc error (TS2554) — the partial branch is only reachable through the
 *   union type, never by direct application;
 * - a full-arity call types as the UNION of both constituents' return types (not `string`).
 */

// Fixtures are real values (not `declare const`) so these files stay executable if
// `types/**/*.test-d.ts` is ever added to `test.include` — running them turns a typo inside
// a `@ts-expect-error` line into a ReferenceError instead of a silent pass (vitest docs TIP).
const three = (a: number, b: string, c: boolean) => `${a}${b}${c}`;
const one = (a: string) => a.length;
const zero = () => 42;

// Exact expansion of `Curried<typeof three>`: step 1 takes `number`, step 2 takes `string`,
// step 3 is a plain `(c: boolean) => string`; the last union member is the one-shot call.
type CurriedThree =
    | ((arg: number) => ((arg: string) => (c: boolean) => string) | ((args_0: string, c: boolean) => string))
    | ((args_0: number, b: string, c: boolean) => string);

test('functionCurry returns 0- and 1-parameter signatures unchanged (Rest extends [] branch)', () => {
    expectTypeOf(functionCurry(one)).toEqualTypeOf<(a: string) => number>();
    expectTypeOf(functionCurry(zero)).toEqualTypeOf<() => number>();
    // The unchanged signatures are still directly callable with the original result type.
    expectTypeOf(functionCurry(one)('x')).toBeNumber();
    expectTypeOf(functionCurry(zero)()).toBeNumber();
});

test('functionCurry expands a 3-parameter signature into the partial/full union', () => {
    expectTypeOf(functionCurry(three)).toEqualTypeOf<CurriedThree>();
});

test('a full-arity call types as the union of both constituents, not as string', () => {
    // tsc unions the return types of every constituent that accepts the arguments, so the
    // next partial-application steps stay visible in the result type.
    expectTypeOf(functionCurry(three)(1, 'x', true)).toEqualTypeOf<
        string | ((arg: string) => (c: boolean) => string) | ((args_0: string, c: boolean) => string)
    >();
});

test('the curried union enforces the parameter types of its constituents', () => {
    // @ts-expect-error TS2345: the first parameter of every constituent is `number`
    const wrongFirst = functionCurry(three)('x', 'x', true);
    void wrongFirst;
});

test('partial application is typed away: a 1-argument call is rejected by tsc (TS2554)', () => {
    // `curried(1)` fires nothing at runtime (it returns a bound function) but tsc requires
    // the widest arity of the union. Pinning this so any change to `Curried<F>` that makes
    // partial application type-safe (or breaks it further) fails here loudly.
    // @ts-expect-error TS2554: Expected 3 arguments, but got 1
    const partial = functionCurry(three)(1);
    void partial;
});

test('the unchanged 1-parameter signature still rejects a wrong argument type', () => {
    // @ts-expect-error TS2345: `one` only accepts a string
    const wrong = functionCurry(one)(42);
    void wrong;
});
