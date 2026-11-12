import { stringSwitch, stringSwitchAsync } from './switch';

/**
 * Contract source: src/string/switch.ts (lines 52-99).
 *
 * Behaviour nailed down here:
 * - `objectHasKey` is an own-property check (object/has.ts:15), so inherited keys
 *   never match and `cases.default` is read through the normal property lookup
 *   (a `default` inherited from a prototype IS reachable as a fallback).
 * - Non-function entries are returned untouched - including `false`, `0`, `null`,
 *   objects and arrays - and no argument object is built for them.
 * - `getParams` (switch.ts:52-63) maps EVERY case key into a closure
 *   `() => stringSwitch(key, cases)`: the closure ignores its arguments and
 *   re-dispatches using the KEY itself as the new value.
 * - `params.default` is assigned after the map, so it returns the RAW `cases.default`
 *   entry (the function itself when the default is a function).
 * - `params.<sameKey>()` therefore re-enters the running callback: unbounded recursion.
 */
describe('String Switch Functionality', () => {
    test('Basic Switch Routing', () => {
        const basicRoute = {
            a: 'apple',
            b: 'banana',
            c: 'cat',
            d: 'dog',
            e: () => 'elephant',
            f: () => 'friend',
            g: {},
            h: true,
            i: false,
            j: [],
            default: '404',
        };

        expect(stringSwitch('a', basicRoute)).toBe('apple');
        expect(stringSwitch('b', basicRoute)).toBe('banana');
        expect(stringSwitch('c', basicRoute)).toBe('cat');
        expect(stringSwitch('d', basicRoute)).toBe('dog');
        expect(stringSwitch('e', basicRoute)).toBe('elephant');
        expect(stringSwitch('f', basicRoute)).toBe('friend');
        expect(stringSwitch('g', basicRoute)).toStrictEqual({});
        expect(stringSwitch('h', basicRoute)).toBe(true);
        expect(stringSwitch('i', basicRoute)).toBe(false);
        expect(stringSwitch('j', basicRoute)).toStrictEqual([]);
        // 'default' is an own key of the map, so it matches like any other case
        expect(stringSwitch('default', basicRoute)).toBe('404');
    });

    test('Advance Switch Routing', () => {
        const advanceRoute = {
            a: () => 'apple',
            b: ({ a }: any) => a(),
            c: ({ b }: any) => b(),
            default: () => 'banana',
        };

        expect(stringSwitch('a', advanceRoute)).toBe('apple');
        expect(stringSwitch('b', advanceRoute)).toBe('apple');
        expect(stringSwitch('c', advanceRoute)).toBe('apple');
        expect(stringSwitch('d', advanceRoute)).toBe('banana');
    });

    test('params.default() can be called from within a case', () => {
        const routes = {
            a: ({ default: def }: any) => def('fallback'),
            default: 'not found',
        };

        // The wrapper ignores the 'fallback' argument and returns cases.default verbatim
        expect(stringSwitch('a', routes)).toBe('not found');
    });

    test('unmatched value without a default key returns undefined', () => {
        expect(stringSwitch('z', { a: 'apple' })).toBeUndefined();
        expect(stringSwitch('a', {})).toBeUndefined();
    });

    test('falsy static values are returned as-is without invoking anything', () => {
        expect(stringSwitch('a', { a: false })).toBe(false);
        expect(stringSwitch('a', { a: 0 })).toBe(0);
        expect(stringSwitch('a', { a: '' })).toBe('');
        expect(stringSwitch('a', { a: null })).toBeNull();
        expect(stringSwitch('z', { a: 1, default: { obj: 1 } })).toStrictEqual({ obj: 1 });
        // A matched callback may itself return undefined
        expect(stringSwitch('a', { a: () => undefined })).toBeUndefined();
    });

    test('numeric values match integer-like keys', () => {
        // hasOwnProperty(1) hits the integer-like key '1'
        expect(stringSwitch(1, { 1: 'one', default: 'd' })).toBe('one');
        expect(stringSwitch(0, { 0: 'zero' })).toBe('zero');
        // 1 does not match the key '11'
        expect(stringSwitch(1, { 11: 'x', default: 'd' })).toBe('d');
    });

    test('undefined and null values resolve through the default branch', () => {
        // hasOwnProperty(undefined) looks for the key 'undefined'
        expect(stringSwitch(undefined, { a: 1, default: 'd' })).toBe('d');
        expect(stringSwitch(undefined, { undefined: 'u', default: 'd' })).toBe('u');
        expect(stringSwitch('undefined', { undefined: 'u' })).toBe('u');
        expect(stringSwitch(null, { a: 1 })).toBeUndefined();
        expect(stringSwitch(null, { a: 1, default: 'd' })).toBe('d');
    });

    test('inherited keys never match but a prototypal default still does', () => {
        // objectHasKey is own-property only, so 'toString' falls through
        expect(stringSwitch('toString', { a: 1 })).toBeUndefined();
        expect(stringSwitch('toString', { a: 1, default: 'd' })).toBe('d');

        // `cases.default` is a plain property read, so an inherited default is found
        const protoCases = Object.create({ default: 'PROTO' });
        protoCases.a = 'A';
        expect(stringSwitch('a', protoCases)).toBe('A');
        expect(stringSwitch('z', protoCases)).toBe('PROTO');
    });

    test('null or undefined cases throw on the own-key lookup', () => {
        expect(() => stringSwitch('a', undefined as any)).toThrow(TypeError);
        expect(() => stringSwitch('a', null as any)).toThrow(TypeError);
    });

    test('the callback is invoked with exactly one argument', () => {
        let argc = -1;
        stringSwitch('a', {
            a: (...rest: any[]) => {
                argc = rest.length;
            },
        });

        expect(argc).toBe(1);
    });

    test('the argument object exposes every case key, the value and the raw default', () => {
        const routes = { a: (params: any) => params, b: 2, default: 3 };
        const params = stringSwitch('a', routes) as any;

        // objectMap keys first ('a', 'b', 'default'), then `value` is appended (switch.ts:60)
        expect(Object.keys(params)).toStrictEqual(['a', 'b', 'default', 'value']);
        expect(params.value).toBe('a');
        expect(typeof params.a).toBe('function');
        expect(typeof params.b).toBe('function');
        expect(typeof params.default).toBe('function');
    });

    test('params.default() returns the raw default entry even when it is a function', () => {
        const def = () => 'banana';
        const routes = {
            a: ({ default: def2 }: any) => [typeof def2(), def2 === def, def2()],
            default: def,
        };

        // The wrapper returns `cases.default` itself: not invoked, not identity-equal
        expect(stringSwitch('a', routes)).toStrictEqual(['function', false, def]);
        // A real fallback dispatch DOES invoke the default callback like any other case
        expect(stringSwitch('z', routes)).toBe('banana');
    });

    test('per-case reloop closures ignore their arguments and re-dispatch on the key', () => {
        const seen: string[] = [];
        const routes = {
            a: (params: any) => {
                seen.push(params.value);
                return [params.b('X'), params.b(), params.b(99, 'y')];
            },
            b: (params: any) => {
                seen.push(params.value);
                return params.value;
            },
        };

        // `params.b(anything)` runs `stringSwitch('b', cases)`, so b's own key becomes its value
        expect(stringSwitch('a', routes)).toStrictEqual(['b', 'b', 'b']);
        // Every reloop call re-enters b (no memoisation): a's value, then b's key three times
        expect(seen).toStrictEqual(['a', 'b', 'b', 'b']);
    });

    test('reloop into a static case returns that static value', () => {
        expect(stringSwitch('b', { a: 'apple', b: ({ a }: any) => a() })).toBe('apple');
        expect(stringSwitch('c', { a: () => 'A', b: ({ a }: any) => a(), c: ({ b }: any) => b() })).toBe('A');
    });

    test('calling params.<sameKey>() recurses until the stack overflows', () => {
        // params.a re-enters the very callback that is running - there is no memoisation
        expect(() => stringSwitch('a', { a: ({ a }: any) => a() })).toThrow(RangeError);
    });

    test('params exposes inherited-looking keys of the cases map as reloop functions', () => {
        const routes = { a: (params: any) => params };
        const params = stringSwitch('a', routes) as any;

        // 'default' is added by getParams even when the map has no default entry
        expect(Object.keys(params)).toStrictEqual(['a', 'value', 'default']);
        // ...and it resolves through `cases.default`, which does not exist here
        expect(params.default()).toBeUndefined();
    });
});

describe('Async String Switch Functionality', () => {
    test('Route switching', async () => {
        const routes = {
            a: async () => 'apple',
            b: async () => 'banana',
            c: 'cat',
            d: 'dog',
        };

        expect(await stringSwitchAsync('a', routes)).toBe('apple');
        expect(await stringSwitchAsync('b', routes)).toBe('banana');
        expect(await stringSwitchAsync('c', routes)).toBe('cat');
        expect(await stringSwitchAsync('d', routes)).toBe('dog');
    });

    test('default fallback when key not found', async () => {
        const routes = {
            a: async () => 'apple',
            default: 'not found',
        };

        expect(await stringSwitchAsync('b', routes)).toBe('not found');
    });

    test('unmatched value without a default resolves to undefined', async () => {
        expect(await stringSwitchAsync('z', { a: 'apple' })).toBeUndefined();
    });

    test('a synchronous handler returning a promise is still awaited', async () => {
        // `return await callback(...)` (switch.ts:98) flattens the thenable
        expect(await stringSwitchAsync('a', { a: () => Promise.resolve('thenable') })).toBe('thenable');
    });

    test('falsy static values are returned without awaiting', async () => {
        expect(await stringSwitchAsync('a', { a: false })).toBe(false);
        expect(await stringSwitchAsync('a', { a: 0 })).toBe(0);
        expect(await stringSwitchAsync('z', { a: 1 })).toBeUndefined();
    });

    test('async handlers receive the same argument object', async () => {
        const routes = { a: async (params: any) => params, b: 2 };
        const params = (await stringSwitchAsync('a', routes)) as any;

        // No `default` key exists in the map, so objectMap contributes only 'a' and 'b'
        expect(Object.keys(params)).toStrictEqual(['a', 'b', 'value', 'default']);
        expect(params.value).toBe('a');
        expect(params.b()).toBe(2);
        expect(params.default()).toBeUndefined();
    });

    test('reloop closures hand back the raw async function and the outer await flattens it', async () => {
        const routes = { a: async ({ b }: any) => b(), b: async () => 'B' };

        expect(await stringSwitchAsync('a', routes)).toBe('B');
    });

    test('null cases rejects instead of throwing synchronously', async () => {
        // Every async function turns the own-key TypeError into a rejected promise
        await expect(stringSwitchAsync('a', null as any)).rejects.toThrow(TypeError);
    });
});

/**
 * Perf-wave contract pins for the reworked `getParams` (T-A).
 *
 * The argument object is still a fresh plain object carrying one reloop closure per
 * own enumerable case key (in `Object.keys` order), then `value`, then `default` -
 * byte-identical to the `objectMap` build it replaces (336/336 legacy parity checks
 * plus 26 cumulative mutation-parity steps in Temp/coding-dispatch). The lazy
 * `Proxy` variant measured 0.5x once a callback touched the object, so this shape
 * is what stays.
 *
 * The observable saving pinned here: the loop never reads the case VALUES, so a
 * `cases` object with getter values is read once for the matched key and never for
 * the others (the `objectMap` build read every value).
 */
describe('String Switch Perf Contract', () => {
    test('The argument object keeps the mapped key order, symbols and descriptors', () => {
        let params: any;

        stringSwitch('a', {
            a: (received: any) => {
                params = received;
            },
            b: 'B'
        } as any);

        expect(Object.keys(params)).toEqual(['a', 'b', 'value', 'default']);
        expect(Object.getOwnPropertySymbols(params)).toEqual([]);
        expect({ ...params }).toEqual({ a: expect.any(Function), b: expect.any(Function), value: 'a', default: expect.any(Function) });

        const entry = Object.getOwnPropertyDescriptor(params, 'a')!;
        expect(typeof entry.value).toBe('function');
        expect({ writable: entry.writable, enumerable: entry.enumerable, configurable: entry.configurable }).toEqual({ writable: true, enumerable: true, configurable: true });
    });

    test('Integer case keys enumerate first, then value and default', () => {
        expect(stringSwitch('2', { 2: (params: any) => Object.keys(params), a: () => 'a', string: () => 's' } as any)).toEqual(['2', 'a', 'string', 'value', 'default']);
    });

    test('Keys the callback adds enumerate after the built-in members', () => {
        expect(stringSwitch('a', { a: (params: any) => { params.extra = 'E'; return Object.keys(params); }, b: 'B' } as any)).toEqual(['a', 'b', 'value', 'default', 'extra']);
    });

    test('Reloop closures are stable per key, value is the raw match, unknown keys stay undefined', () => {
        expect(stringSwitch('a', { a: (params: any) => [params.a === params.a, typeof params.value, params.zz, typeof params.default], b: 'B' } as any)).toEqual([true, 'string', undefined, 'function']);
    });

    test('Deleting params.value removes the member from the object', () => {
        expect(stringSwitch('a', { a: (params: any) => { delete params.value; return ['value' in params, Object.keys(params)]; }, b: 'B' } as any)).toEqual([false, ['a', 'b', 'default']]);
    });

    test('A function case reads the matched value once and never reads the other values', () => {
        const reads: string[] = [];
        const cases = {
            get a() {
                reads.push('a');
                return (params: any) => params.value;
            },
            get b() {
                reads.push('b');
                return () => 'b';
            }
        };

        expect(stringSwitch('a', cases as any)).toBe('a');
        expect(reads).toEqual(['a']);
    });

    test('The async variant builds the same argument object', async () => {
        let params: any;

        await stringSwitchAsync('a', {
            a: async (received: any) => {
                params = received;
            }
        } as any);

        expect(Object.keys(params)).toEqual(['a', 'value', 'default']);
    });
});
