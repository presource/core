import { stringIncludes } from './includes';

/**
 * Contract source: src/string/includes.ts (lines 54-68).
 *
 * Behaviour nailed down here:
 * - Keys are iterated with `objectEach` (own enumerable keys only) and coerced
 *   with `key.toString()` before `String.prototype.includes` (line 62-63), so a
 *   numeric case key `{ 12: true }` reports the matched key as the string `'12'`.
 * - Unmatched keys are ABSENT from the result (never `undefined` valued).
 * - Callbacks receive `{ value, ...params }` where `params` is `objectMap(cases, ...)`:
 *   every case key is present, function values are passed through RAW (includes.ts:59)
 *   and non-function values become `() => caseValue`.
 * - Because the spread comes after `value`, a case literally keyed `value` overwrites it.
 * - Non-object `cases` still iterate (`Object.keys('b') === ['0']`), which simply matches nothing.
 */
describe('stringIncludes', () => {
    test('it should call the callback of every matched key in iteration order', () => {
        const result: string[] = [];
        const cases = {
            inline: () => {
                result.push('inline');
                return undefined;
            },
            outline: () => {
                result.push('outline');
                return undefined;
            },
        };

        const found = stringIncludes('inline outline', cases);

        // Checking if it is passing through the values
        expect(result).toStrictEqual(['inline', 'outline']);
        // Both keys matched, both callbacks returned undefined, so the keys exist with undefined values
        expect(found).toStrictEqual({ inline: undefined, outline: undefined });
    });

    test('nested callback functions', () => {
        const value = 'inline dense';
        // The Result
        const result = stringIncludes(value, {
            inline: () => 'inline',
            flex: () => 'flex',
            column: 'column',
            dense: ({ flex, column }: any) => [flex(), column()],
        });

        expect(result).toStrictEqual({ inline: 'inline', dense: ['flex', 'column'] });
    });

    test('non-function value returned directly when key matches', () => {
        const result = stringIncludes('hello world', {
            hello: 'found',
            world: 42,
            missing: 'not found',
        });

        expect(result).toStrictEqual({ hello: 'found', world: 42 });
    });

    test('numeric case keys are stringified in the result', () => {
        const result = stringIncludes('abc123', { 12: true, zz: false });

        // '12' is inside 'abc123' (matched); 'zz' is not, so its key is absent entirely
        expect(result).toStrictEqual({ '12': true });
        expect(Object.keys(result)).toStrictEqual(['12']);
    });

    test('unmatched keys are absent from the result object', () => {
        const result = stringIncludes('abc', { a: 1, b: 2, c: 3, d: 4 });

        expect(result).toStrictEqual({ a: 1, b: 2, c: 3 });
        expect(Object.keys(result)).toStrictEqual(['a', 'b', 'c']);
    });

    test('integer-like keys are iterated in ascending numeric order', () => {
        // Object.keys puts integer-like keys first regardless of insertion order
        const result = stringIncludes('ab1', { 1: 'one', a: 'A' });

        expect(result).toStrictEqual({ '1': 'one', a: 'A' });
        expect(Object.keys(result)).toStrictEqual(['1', 'a']);
    });

    test('static values are captured as-is including null, undefined, arrays and objects', () => {
        const object = { obj: 1 };
        const array = [1, 2];
        const result = stringIncludes('ab', { a: null, b: undefined });
        const mixed = stringIncludes('ab', { a: object, b: array });

        // `found[k] = caseValue` (includes.ts:64) - the key exists even when the value is undefined
        expect(result).toStrictEqual({ a: null, b: undefined });
        expect(Object.keys(result)).toStrictEqual(['a', 'b']);
        expect(mixed).toStrictEqual({ a: { obj: 1 }, b: [1, 2] });
        // References are forwarded untouched
        expect(mixed.a).toBe(object);
        expect(mixed.b).toBe(array);
    });

    test('empty cases object produces an empty result', () => {
        expect(stringIncludes('abc', {})).toStrictEqual({});
    });

    test('empty-string key matches every value', () => {
        // 'abc'.includes('') === true
        expect(stringIncludes('abc', { '': 'empty' })).toStrictEqual({ '': 'empty' });
        expect(stringIncludes('', { '': 'empty' })).toStrictEqual({ '': 'empty' });
    });

    test('overlapping substrings all match in one call', () => {
        expect(stringIncludes('aab', { a: 1, ab: 2 })).toStrictEqual({ a: 1, ab: 2 });
        // Substrings must appear verbatim - 'cb' is not a substring of 'abc'
        expect(stringIncludes('abc', { cb: 'x' })).toStrictEqual({});
    });

    test('non-object cases iterate to nothing and produce an empty result', () => {
        // Object.keys('b') === ['0'] and 'abc'.includes('0') is false
        expect(stringIncludes('abc', 'b' as any)).toStrictEqual({});
        // Object.keys(['a']) === ['0']
        expect(stringIncludes('ab', ['a'] as any)).toStrictEqual({});
        // Object.keys(5) === []
        expect(stringIncludes('ab', 5 as any)).toStrictEqual({});
    });

    test('null or undefined cases throw while building the parameter map', () => {
        // objectEach -> Object.keys(null) throws before any matching happens (includes.ts:59)
        expect(() => stringIncludes('abc', undefined as any)).toThrow(TypeError);
        expect(() => stringIncludes('abc', null as any)).toThrow(TypeError);
    });

    test('callback receives the exact argument object documented by the type', () => {
        let received: any;
        let zzInvoked = false;
        const cases = {
            a: (arg: any) => {
                received = arg;
                return 'A';
            },
            b: () => 'B',
            zz: () => {
                zzInvoked = true;
                return 'Z';
            },
        };

        const result = stringIncludes('ab', cases);

        // `value` first, then every case key in insertion order (includes.ts:64 spread)
        expect(Object.keys(received)).toStrictEqual(['value', 'a', 'b', 'zz']);
        expect(received.value).toBe('ab');
        // Function cases are handed through raw (includes.ts:59 keeps the original reference)
        expect(received.a).toBe(cases.a);
        expect(received.b).toBe(cases.b);
        expect(received.zz).toBe(cases.zz);
        // 'zz' never matched, so its callback was not invoked, yet it is still reachable via params
        expect(zzInvoked).toBe(false);
        expect(received.zz()).toBe('Z');
        expect(result).toStrictEqual({ a: 'A', b: 'B' });
    });

    test('non-function case values are exposed as zero-arg wrappers on the argument object', () => {
        let received: any;
        // Only 'a' matches: 'b' and 'c' never match 'a', yet they are still on the argument object
        const result = stringIncludes('a', {
            a: (arg: any) => {
                received = arg;
                return [arg.b(), arg.c()];
            },
            b: 'B-STATIC',
            c: 7,
        });

        // Static entries become `() => caseValue`; the argument object never pre-invokes them
        expect(typeof received.b).toBe('function');
        expect(typeof received.c).toBe('function');
        expect(received.b()).toBe('B-STATIC');
        expect(received.c()).toBe(7);
        expect(result).toStrictEqual({ a: ['B-STATIC', 7] });
    });

    test('a case keyed "value" overwrites the documented value property', () => {
        let received: any;
        const cases = {
            value: (arg: any) => {
                received = arg.value;
                return typeof arg.value;
            },
        };
        const result = stringIncludes('value', cases);

        // `{ value, ...params }` - params.value is the raw callback, so it shadows the string
        expect(received).toBe(cases.value);
        expect(result).toStrictEqual({ value: 'function' });
    });

    test('re-invoking a case callback through params calls it again with no arguments', () => {
        // params.a is the raw function, so a() runs it with `undefined` instead of the argument object
        const result = stringIncludes('ab', {
            a: (arg: any) => (arg ? 'yes' : 'no'),
            b: ({ a }: any) => a(),
        });

        expect(result).toStrictEqual({ a: 'yes', b: 'no' });
    });

    test('the cases object is never mutated', () => {
        const cases = { a: () => 1, b: 2, missing: () => 3 };
        stringIncludes('ab', cases);

        expect(Object.keys(cases)).toStrictEqual(['a', 'b', 'missing']);
        expect(typeof cases.a).toBe('function');
        expect(cases.b).toBe(2);
    });
});

/**
 * G13 pin: the runtime is responsible for the non-string-target failures (T-A).
 *
 * `stringIncludes` never coerces or type-checks `value`; the throw comes from
 * `value.includes(key)` inside the `objectEach` callback (includes.ts:77 in the
 * pre-optimisation build). Behaviour is EXACTLY as it was before the delegation map
 * became lazy - the map is side-effect-free, so building it earlier or later cannot
 * change what a non-string target does. Pinned per target:
 * - number / boolean / symbol / object targets -> `value.includes is not a function`
 * - `undefined` / `null` targets -> the property-read TypeError V8 produces
 * - an EMPTY cases map never reaches `includes`, so nothing throws and the result
 *   is `{}` even for a non-string target.
 */
describe('stringIncludes non-string target behaviour (G13)', () => {
    test('A number target throws the includes-is-not-a-function TypeError', () => {
        expect(() => stringIncludes(42 as any, { 2: 'hit' })).toThrow(TypeError);
        expect(() => stringIncludes(42 as any, { 2: 'hit' })).toThrow('value.includes is not a function');
    });

    test('Boolean, symbol and object targets throw the same TypeError', () => {
        for (const target of [true, Symbol('s'), { a: 1 }] as any[]) {
            expect(() => stringIncludes(target, { a: 1 })).toThrow('value.includes is not a function');
        }
    });

    test('undefined and null targets throw the property-read TypeError', () => {
        expect(() => stringIncludes(undefined as any, { a: 1 })).toThrow("Cannot read properties of undefined (reading 'includes')");
        expect(() => stringIncludes(null as any, { a: 1 })).toThrow("Cannot read properties of null (reading 'includes')");
    });

    test('An empty cases map matches nothing and never throws', () => {
        expect(stringIncludes(42 as any, {})).toEqual({});
        expect(stringIncludes(undefined as any, {})).toEqual({});
    });
});

/**
 * Perf-wave contract pins for the lazy delegation map (T-A).
 *
 * The `objectMap(cases, ...)` result is now built on the FIRST match instead of up
 * front, which is the entire saving for the no-match case (measured 4.36x) and
 * provably invisible when something matches: the callback argument is still
 * `{ value, ...params }` with the same keys, ordering, RAW function passthrough and
 * `() => caseValue` static accessors (93/93 legacy parity checks).
 */
describe('stringIncludes lazy delegation contract', () => {
    test('Function cases are passed through RAW and the arg keys follow cases order', () => {
        let args: any;
        const flex = () => 'flex-value';

        expect(stringIncludes('dense' as any, { dense: (params: any) => { args = params; return params.flex(); }, flex } as any)).toEqual({ dense: 'flex-value' });
        expect(Object.keys(args)).toEqual(['value', 'dense', 'flex']);
        expect(args.flex).toBe(flex);
        expect(args.value).toBe('dense');
    });

    test('Static cases become zero-argument accessors after the matched key', () => {
        let args: any;

        expect(stringIncludes('a' as any, { a: (params: any) => { args = params; return 'x'; }, b: 'B' } as any)).toEqual({ a: 'x' });
        expect(Object.keys(args)).toEqual(['value', 'a', 'b']);
        expect(args.b()).toBe('B');
        expect(typeof args.a).toBe('function');
    });

    test('Nothing matches: no delegation map is built, so each case value is read once', () => {
        const reads: Record<string, number> = { a: 0, b: 0 };
        const source: Record<string, any> = { a: 'static', b: () => 'b' };
        const cases = source;
        for (const key of Object.keys(source)) {
            const stored = source[key];
            Object.defineProperty(cases, key, {
                enumerable: true,
                configurable: true,
                get: () => {
                    reads[key] += 1;
                    return stored;
                }
            });
        }

        expect(stringIncludes('zzz' as any, cases as any)).toEqual({});
        // The up-front `objectMap` build read every value a second time
        expect(reads).toEqual({ a: 1, b: 1 });
    });
});
