import { test, expectTypeOf } from 'vitest';

import { functionProxy, functionState } from '@presource/core';

/**
 * Type-level contract for the proxy-backed utilities — `functionProxy`
 * (src/function/proxy.ts) and `functionState` (src/function/state.ts).
 *
 * These are the two places in the package whose public API is deliberately dynamic, and the
 * assertions below pin exactly how dynamic, so a later typing pass (or an accidental
 * loosening) cannot change the surface silently:
 * - `functionProxy` returns `any` (the Proxy result is not narrowed to the target signature),
 *   therefore every property read and every call through the proxy is unchecked;
 * - the interceptor argument IS statically typed:
 *   `{ method: 'call' | 'get' | 'set'; key: string | null; params: any[] }`;
 * - `functionState()` returns `Wrapper`: one slot per call, seeded with a callback or a
 *   string/number/boolean primitive, and every slot accessor is `any`;
 * - the settings group is structurally free (`Setting = {}`) — any object shape is accepted.
 */

test('functionProxy returns an untyped callable while typing the interceptor argument', () => {
    const proxy = functionProxy(({ method, key, params }) => {
        expectTypeOf(method).toEqualTypeOf<'call' | 'get' | 'set'>();
        expectTypeOf(key).toEqualTypeOf<string | null>();
        expectTypeOf(params).toEqualTypeOf<any[]>();
    });
    expectTypeOf(proxy).toBeAny();
    // Consequence of the `any` return: nothing below is verified by tsc.
    expectTypeOf(proxy.anyProperty).toBeAny();
    expectTypeOf(proxy(1, 2, 3)).toBeAny();
});

test('functionState slots accept callbacks and primitives, and always hand back any', () => {
    const state = functionState();
    expectTypeOf(state).toEqualTypeOf<(callback: ((...params: any[]) => any) | string | number | boolean) => any>();
    expectTypeOf(state(1)).toBeAny();
    expectTypeOf(state('count')).toBeAny();
    expectTypeOf(state(true)).toBeAny();
    expectTypeOf(state((value: number) => value + 1)).toBeAny();
});

test('the settings group is structurally free and returns the same Wrapper', () => {
    const state = functionState();
    expectTypeOf(functionState({ limit: 1 })).toEqualTypeOf<typeof state>();
    expectTypeOf(functionState()).toEqualTypeOf<typeof state>();
});

test('a slot rejects values that are neither a callback nor a primitive', () => {
    const state = functionState();
    // @ts-expect-error TS2345: Argument of type '{}' is not assignable to parameter of type 'string | number | boolean | Callback'
    const slot = state({});
    void slot;
});
