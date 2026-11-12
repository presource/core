import { test, expectTypeOf } from 'vitest';

import { functionOptions } from '@presource/core';

/**
 * Type-level contract for `functionOptions` (src/function/options.ts) — the `Handler<Options>`
 * pattern: an options object INTERSECTED with two call signatures (module-private types):
 *   <NewOptions extends CallbackFunction>(newOptions: NewOptions) => Handler<Options & NewOptions>
 *   () => { reset: () => void; update: (newOptions: CallbackFunction) => void }
 * with `CallbackFunction = { [key: string]: (...inputs: any[]) => Promise<any> }`.
 * Pinned: members are typed from the declared options, the zero-argument call selects the
 * management overload, extension accumulates option sets into a new Handler (recursively),
 * async-only values are enforced, and undeclared members are rejected statically even though
 * the runtime `objectProxy` fallback would resolve them dynamically.
 */

type CallbackFunction = { [key: string]: (...inputs: any[]) => Promise<any> };
type Controls = { reset: () => void; update: (newOptions: CallbackFunction) => void };

const baseOptions = functionOptions({ load: async (id: string) => id });

test('declared options are exposed as typed members', () => {
    expectTypeOf(baseOptions.load).toEqualTypeOf<(id: string) => Promise<string>>();
    expectTypeOf(baseOptions.load('u-1')).toEqualTypeOf<Promise<string>>();
});

test('the zero-argument call selects the management overload', () => {
    expectTypeOf(baseOptions()).toEqualTypeOf<Controls>();
    // @ts-expect-error TS2339: the no-argument overload returns `{ reset, update }`, not the options
    const { load } = baseOptions();
    void load;
});

test('calling with new options returns a Handler that accumulates both option sets', () => {
    const child = baseOptions({ save: async (v: number) => v });
    expectTypeOf(child.load).toEqualTypeOf<(id: string) => Promise<string>>();
    expectTypeOf(child.save).toEqualTypeOf<(v: number) => Promise<number>>();
    // The extended handler keeps both Handler call signatures.
    expectTypeOf(child()).toEqualTypeOf<Controls>();

    // Extension is recursive: a grandchild keeps every ancestor option.
    const grandChild = child({ remove: async (id: string) => true });
    expectTypeOf(grandChild.remove).toEqualTypeOf<(id: string) => Promise<boolean>>();
    expectTypeOf(grandChild.load).toEqualTypeOf<(id: string) => Promise<string>>();
    expectTypeOf(grandChild.save).toEqualTypeOf<(v: number) => Promise<number>>();
});

test('option values must be Promise-returning', () => {
    // @ts-expect-error TS2322: a synchronous handler does not satisfy `Promise<any>`
    const sync = baseOptions({ sync: () => 1 });
    void sync;
    // Positive control for the same constraint: async is accepted and keeps its value type.
    const ok = baseOptions({ ping: async () => 1 });
    expectTypeOf(ok.ping).toEqualTypeOf<() => Promise<number>>();
});

test('undeclared members and bad member arity are rejected statically', () => {
    // @ts-expect-error TS2339: Property 'unknown' does not exist on Handler<{ load: ... }>
    const missing = baseOptions.unknown;
    void missing;
    // @ts-expect-error TS2554: `load` requires its `id` argument — the member signature is not
    // shadowed by the Handler's zero-argument management overload.
    const noArgument = baseOptions.load();
    void noArgument;
});
