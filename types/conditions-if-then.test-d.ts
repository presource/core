import { test, expectTypeOf } from 'vitest';

import { ifThen } from '@presource/core';

/**
 * Type-level contract for `ifThen` (src/conditions/then.ts).
 *
 * `Condition` and `Callback` are module-private and mutually recursive:
 *   Condition = (args: { callback: Callback }) => boolean
 *   Callback  = (args: { condition: Condition }) => any
 * Pinned: the parameter pair, the bidirectional contextual typing inside both callbacks,
 * the `boolean`-only condition return, the fixed arity, the exact callback argument shape,
 * and the fact that the call result is `any` (the callback's return type is not carried out,
 * and the "condition was false" branch is not represented in the type).
 */

// Structural mirrors of the private recursive pair — these are the `expectTypeOf` targets.
type ExpectedCondition = (args: { callback: ExpectedCallback }) => boolean;
type ExpectedCallback = (args: { condition: ExpectedCondition }) => any;

test('ifThen takes exactly (Condition, Callback)', () => {
    expectTypeOf(ifThen).parameters.toEqualTypeOf<[ExpectedCondition, ExpectedCallback]>();
});

test('the condition is contextually typed with the callback and the callback with the condition', () => {
    ifThen(
        ({ callback }) => {
            // Recursion is typed in both directions: the condition may invoke the callback...
            expectTypeOf(callback).toEqualTypeOf<ExpectedCallback>();
            return true;
        },
        ({ condition }) => {
            // ...and the callback receives the condition back for chained if-then constructs.
            expectTypeOf(condition).toEqualTypeOf<ExpectedCondition>();
            return 'only reached when the condition is true';
        },
    );
});

test('the call result is any regardless of the callback return type', () => {
    // `Callback` returns `any`, so a string callback still yields `any` — not `string`.
    expectTypeOf(ifThen(() => true, () => 'string result')).toBeAny();
    expectTypeOf(ifThen(() => false, () => 42)).toBeAny();
    // A callback that returns nothing is accepted too (still `any`, not `void`).
    expectTypeOf(ifThen(() => true, () => undefined)).toBeAny();
});

test('the condition must return boolean', () => {
    // @ts-expect-error TS2322: a truthy string is not a boolean
    ifThen(() => 'nope', () => 1);
});

test('ifThen takes exactly two arguments', () => {
    // @ts-expect-error TS2554: Expected 2 arguments, but got 3
    ifThen(() => true, () => 1, 'extra');
});

test('the callback argument carries `condition` only', () => {
    // @ts-expect-error TS2339: Property 'nope' does not exist on type '{ condition: Condition }'
    ifThen(() => true, ({ nope }) => nope);
});
