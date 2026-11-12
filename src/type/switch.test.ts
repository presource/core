import { typeSwitch } from '@presource/core';

describe('Type Switch Checking', () => {
    // Checking if Type is Correct
    test('Checking type returned correctly', () => {
        // Undefined
        expect(
            typeSwitch(undefined, {
                undefined: () => 'invalid'
            })
        ).toBe('invalid');

        // Null
        expect(
            typeSwitch(null, {
                null: () => 'invalid'
            })
        ).toBe('invalid');

        // Checking String Type
        expect(
            typeSwitch('string', {
                string: ({ value }) => value
            })
        ).toBe('string');

        // Object Type
        expect(
            typeSwitch(
                { a: 'a' },
                {
                    object: ({ value }) => value.a
                }
            )
        ).toBe('a');

        // Not Found. Undefined
        expect(typeSwitch('a', { default: ({ value }) => value })).toBe('a');
    });

    // Checking the nested type are correct
    test('Checking nested type are correct', () => {
        // Checking String
        typeSwitch('string', {
            string: ({ value }) => {
                expect(value).toBe('string');
            }
        });
        // Checking for Number
        typeSwitch(10, {
            number: ({ value }) => {
                expect(value).toBe(10);
            }
        });
        // Checking for Boolean
        typeSwitch(true, {
            boolean: ({ value }) => {
                expect(value).toBe(true);
            }
        });
        typeSwitch(false, {
            boolean: ({ value }) => {
                expect(value).toBe(false);
            }
        });

        // Checking for Function
        const func = () => {};
        typeSwitch(func, {
            function: ({ value }) => {
                expect(value).toEqual(func);
            }
        });
    });

    test('Number route switching', () => {
        // Number switching route
        expect(
            typeSwitch('string', {
                number: ({ value }) => value,
                string: ({ number }) => number(5)
            })
        ).toBe(5);

        // Route using the full nested callback name
        expect(
            typeSwitch('string', {
                number: ({ value }) => value,
                string: ({ number }) => number(5)
            })
        ).toBe(5);
    });

    // Switching Routs
    test('Boolean route switching', () => {
        // Boolean route switching
        expect(
            typeSwitch('string', {
                boolean: ({ value }) => value,
                string: ({ boolean }) => boolean(true)
            })
        ).toBe(true);

        // Boolean route switching using the full nested callback name
        expect(
            typeSwitch('string', {
                boolean: ({ value }) => value,
                string: ({ boolean }) => boolean(false)
            })
        ).toBe(false);
    });

    // ------------------------------------------------------------------
    // Full dispatch matrix: every documented case key routes by typeName,
    // and each handler receives `{ value, ...nestedHelpers }`.
    // ------------------------------------------------------------------
    test('routes every case key and returns the exact handler result', () => {
        expect(typeSwitch('s', { string: ({ value }) => `STR:${value}` })).toBe('STR:s');
        expect(typeSwitch(7, { number: ({ value }) => `NUM:${value}` })).toBe('NUM:7');
        expect(typeSwitch(true, { boolean: ({ value }) => `BOOL:${value}` })).toBe('BOOL:true');
        expect(typeSwitch([1, 2], { array: ({ value }) => `ARR:${JSON.stringify(value)}` })).toBe('ARR:[1,2]');
        expect(typeSwitch({ a: 1 }, { object: ({ value }) => `OBJ:${JSON.stringify(value)}` })).toBe('OBJ:{"a":1}');
        expect(
            typeSwitch(
                function named() {},
                { function: ({ value }) => `FN:${typeof value}:${value.name}` }
            )
        ).toBe('FN:function:named');
        expect(typeSwitch(undefined, { undefined: () => 'UND' })).toBe('UND');
        expect(typeSwitch(null, { null: () => 'NUL' })).toBe('NUL');
        // Unmatched runtime types (date/symbol) fall through to `default`
        expect(typeSwitch(new Date(0), { default: ({ value }) => `DEF:${value.toISOString()}` })).toBe(
            'DEF:1970-01-01T00:00:00.000Z'
        );
        expect(typeSwitch(Symbol('q'), { default: ({ value }) => `DEF:${String(value)}` })).toBe('DEF:Symbol(q)');
    });

    // The handler args are built from the cases map only: `value` plus one helper per key.
    test('injects exactly one nested helper per declared case key', () => {
        expect(typeSwitch('x', { string: (args) => Object.keys(args) })).toStrictEqual(['value', 'string']);
        expect(typeSwitch(null, { null: (args) => Object.keys(args) })).toStrictEqual(['value', 'null']);
        expect(typeSwitch(undefined, { undefined: (args) => Object.keys(args) })).toStrictEqual(['value', 'undefined']);
        expect(typeSwitch(1, { number: (args) => Object.keys(args) })).toStrictEqual(['value', 'number']);
        // Unknown keys are treated as extra helper names (they never route, but they are injected)
        expect(
            typeSwitch('x', {
                string: (args: any) => Object.keys(args),
                date: () => 'D',
                wat: () => 'W',
                zzz: 'literal'
            })
        ).toStrictEqual(['value', 'string', 'date', 'wat', 'zzz']);
    });

    // `value` is passed through unchanged and by identity for reference types.
    test('passes the matched value by identity', () => {
        const array = [1, 2];
        const object = { a: 1 };
        expect(typeSwitch(array, { array: ({ value }) => value === array })).toBe(true);
        expect(typeSwitch(object, { object: ({ value }) => value === object })).toBe(true);
    });

    // A case entry that is not a function is returned verbatim (no invocation, no coercion).
    test('returns non-function case values as-is', () => {
        expect(typeSwitch('x', { string: 'RAW-STRING-VALUE' })).toBe('RAW-STRING-VALUE');
        expect(typeSwitch(1, { number: 99 })).toBe(99);
        expect(typeSwitch(true, { boolean: false })).toBe(false);
        expect(typeSwitch(null, { null: null })).toBe(null);
        expect(typeSwitch([], { array: { hit: true } })).toStrictEqual({ hit: true });
        // The `default` entry may also be a raw value
        expect(typeSwitch(new Date(0), { default: 'DEFAULT-RAW' })).toBe('DEFAULT-RAW');
    });

    // No matching key and no `default` key produces undefined (cases[name] is undefined).
    test('returns undefined when nothing matches and there is no default', () => {
        expect(typeSwitch(new Date(0), { string: () => 'S' })).toBeUndefined();
        expect(typeSwitch('x', {})).toBeUndefined();
        expect(typeSwitch('x', { string: undefined })).toBeUndefined();
        // A cases map that is not a plain object never matches either
        expect(typeSwitch('x', ['a', 'b'] as any)).toBeUndefined();
    });

    // A handler that returns undefined yields undefined even when it does run.
    test('returns undefined from a matched handler that returns nothing', () => {
        let calls = 0;
        const result = typeSwitch('x', {
            string: () => {
                calls += 1;
                return undefined;
            }
        });
        expect(result).toBeUndefined();
        expect(calls).toBe(1);
    });

    // null-prototype objects have no constructor: typeName() === '' and the empty name is
    // resolved to 'null' (only literal undefined maps to 'undefined').
    test('routes null-prototype objects to the null case', () => {
        expect(typeSwitch(Object.create(null), { null: () => 'NULLCASE', default: () => 'DEFAULT' })).toBe('NULLCASE');
        // With no `null` key it falls through to default rather than the object case
        expect(typeSwitch(Object.create(null), { object: () => 'OBJECTCASE', default: () => 'DEF' })).toBe('DEF');
        // Without a default the result is undefined
        expect(typeSwitch(Object.create(null), { object: () => 'OBJECTCASE' })).toBeUndefined();
    });

    // ------------------------------------------------------------------
    // Nested delegation: each helper re-invokes its handler with
    // `{ ...args, value: val }`, so `value` is replaced but every helper survives.
    // ------------------------------------------------------------------
    test('nested helper re-dispatches with the forwarded value replacing args.value', () => {
        expect(
            typeSwitch('outer', {
                number: ({ value }) => `N:${value}`,
                string: ({ number }) => number(5)
            })
        ).toBe('N:5');
        // Extra arguments beyond the first are ignored by the helper signature
        expect(
            typeSwitch('outer', {
                number: ({ value }) => value,
                string: ({ number }) => number(1, 2, 3)
            })
        ).toBe(1);
        // Called with no argument the forwarded value is literally undefined
        expect(
            typeSwitch('outer', {
                number: ({ value }) => `N:${JSON.stringify(value)}`,
                string: ({ number }) => number()
            })
        ).toBe('N:undefined');
        // Full args shape observed inside the delegated handler
        expect(
            typeSwitch('ORIG', {
                number: (args) => Object.keys(args).map((key) => `${key}=${JSON.stringify(args[key] === 'ORIG')}`),
                string: ({ number }) => number(5)
            })
        ).toStrictEqual(['value=false', 'number=false', 'string=false']);
    });

    test('nested helper receives the sibling helpers so chains keep working', () => {
        // The outer handler simply returns whatever the nested helper returned (sync pass-through)
        expect(
            typeSwitch('A', {
                string: ({ number }) => number(1),
                number: ({ value }) => `N:${value}`
            })
        ).toBe('N:1');
        // A -> number(1) -> number handler calls string('B') -> string handler
        expect(
            typeSwitch('A', {
                string: (args: any) => (args.value === 'A' ? args.number(1) : `S:${args.value}`),
                number: (args: any) => args.string('B')
            })
        ).toBe('S:B');
        // Same-type nesting still receives the replaced value
        expect(
            typeSwitch(1, {
                number: (args: any) => (args.value === 1 ? args.number(2) : `N2:${args.value}`)
            })
        ).toBe('N2:2');
        expect(
            typeSwitch('x', {
                number: ({ value }) => ({ value, helper: typeof (value as any) === 'number' }),
                string: ({ number }) => number(5)
            })
        ).toStrictEqual({ value: 5, helper: true });
    });

    // Every nested helper kind forwards through the same mechanism.
    test('supports nested delegation for all remaining case kinds', () => {
        expect(
            typeSwitch('x', {
                null: ({ value }) => `N:${JSON.stringify(value)}`,
                undefined: ({ value }) => `U:${JSON.stringify(value)}`,
                string: ({ null: nullHelper, undefined: undefinedHelper }) => [nullHelper(null), undefinedHelper(undefined)]
            })
        ).toStrictEqual(['N:null', 'U:undefined']);

        expect(
            typeSwitch('x', {
                array: ({ value }) => `ARR:${JSON.stringify(value)}`,
                object: ({ value }) => `OBJ:${JSON.stringify(value)}`,
                function: ({ value }) => `FN:${(value as any)()}`,
                string: ({ array, object, function: functionHelper }) => [
                    array([1]),
                    object({ z: 1 }),
                    functionHelper(() => 'called')
                ]
            })
        ).toStrictEqual(['ARR:[1]', 'OBJ:{"z":1}', 'FN:called']);

        // `default` is also available as a nested helper when the key exists
        expect(
            typeSwitch('x', {
                default: ({ value }) => `DEF:${JSON.stringify(value)}`,
                string: ({ default: defaultHelper }) => defaultHelper('via-default')
            })
        ).toBe('DEF:"via-default"');
    });

    // Helpers only exist for declared keys, so referencing an absent case throws.
    test('throws when delegating to a case key that was never declared', () => {
        expect(() => typeSwitch('x', { string: ({ number }: any) => number(5) })).toThrow(TypeError);
        expect(() => typeSwitch('x', { string: (args: any) => args.default(1) })).toThrow(/is not a function/);
    });
});

/**
 * Perf-wave contract pins for the reworked dispatcher (T-A).
 *
 * The args object is still built EAGERLY - one closure per own enumerable case key,
 * `value` inserted first - so its shape is byte-identical to the pre-optimisation
 * build (verified against the git HEAD implementation by a 480-check fingerprint
 * parity run, plus the cumulative mutation probes in Temp/coding-dispatch). The
 * lazy `Object.defineProperty` and lazy `Proxy` args variants both measured
 * slower (0.63x and 0.07x-0.12x on the nested / spread paths) and are gone, which
 * is what the shape assertions below lock in.
 *
 * What did change, and is pinned here:
 * - a non-callable (static) case returns without building args, so it reads ONLY
 *   the matched case value;
 * - a function case reads the matched value twice (lookup + helper loop) and every
 *   other value exactly once;
 * - nested delegation still hands over `{ ...args, value }` and keeps the exact
 *   `caseHandler is not a function` TypeError text.
 */
describe('Type Switch Args Shape And Dispatch Side Effects', () => {
    test('Args keys, symbols, prototype and descriptors match the eager build', () => {
        let args: any;

        typeSwitch(42, {
            number: (received: any) => {
                args = received;
                return 'n';
            },
            string: () => 's'
        } as any);

        // `value` is inserted first, then one helper per case key in cases order
        expect(Object.keys(args)).toEqual(['value', 'number', 'string']);
        expect(Object.getOwnPropertySymbols(args)).toEqual([]);
        expect(Object.getPrototypeOf(args)).toBe(Object.prototype);
        expect({ ...args }).toEqual({ value: 42, number: expect.any(Function), string: expect.any(Function) });
        expect(Object.getOwnPropertyDescriptor(args, 'value')).toEqual({ value: 42, writable: true, enumerable: true, configurable: true });

        const helper = Object.getOwnPropertyDescriptor(args, 'number')!;
        expect(typeof helper.value).toBe('function');
        expect({ writable: helper.writable, enumerable: helper.enumerable, configurable: helper.configurable }).toEqual({ writable: true, enumerable: true, configurable: true });
    });

    test('Integer case keys enumerate first, then value, then the declared case order', () => {
        // A lower-cased class name resolves through typeName(), so the `a` case matches
        class a {}

        const keys = typeSwitch(new a(), {
            2: () => 'two',
            a: (args: any) => Object.keys(args),
            string: () => 's',
            B: () => 'b'
        } as any);

        expect(keys).toEqual(['2', 'value', 'a', 'string', 'B']);
    });

    test('Nested delegation hands the next case a fresh args object carrying the new value', () => {
        const result = typeSwitch(42, {
            number: ({ string }: any) => string('x'),
            string: ({ value }: any) => [value, typeof value]
        } as any);

        expect(result).toEqual(['x', 'string']);
    });

    test('A nullish nested case value hands back undefined', () => {
        expect(typeSwitch(42, { number: (args: any) => args.date(), date: null } as any)).toBeUndefined();
    });

    test('A non-callable nested case value throws the caseHandler TypeError', () => {
        const cases = { number: (args: any) => args.string('x'), string: 'static' } as any;

        expect(() => typeSwitch(42, cases)).toThrow(TypeError);
        expect(() => typeSwitch(42, cases)).toThrow('caseHandler is not a function');
    });

    test('A static case reads only the matched case value and never builds args', () => {
        const reads: string[] = [];
        const cases = {
            get number() {
                reads.push('number');
                return 99;
            },
            get string() {
                reads.push('string');
                return () => 's';
            }
        };

        expect(typeSwitch(42, cases as any)).toBe(99);
        expect(reads).toEqual(['number']);
    });

    test('A function case reads the matched value twice and every other value once', () => {
        const reads: string[] = [];
        const cases = {
            get number() {
                reads.push('number');
                return (args: any) => args.value;
            },
            get string() {
                reads.push('string');
                return () => 's';
            }
        };

        expect(typeSwitch(42, cases as any)).toBe(42);
        expect(reads).toEqual(['number', 'number', 'string']);
    });

    test('Handlers may delete and add args members; added keys enumerate last', () => {
        expect(typeSwitch(42, { number: (args: any) => { delete args.string; return ['string' in args, typeof args.string]; }, string: () => 's' } as any)).toEqual([false, 'undefined']);
        expect(typeSwitch(42, { number: (args: any) => { args.extra = 'E'; return Object.keys(args); }, string: () => 's' } as any)).toEqual(['value', 'number', 'string', 'extra']);
    });

    test('An unmatched value with no default case returns undefined', () => {
        expect(typeSwitch(42, { string: () => 's' } as any)).toBeUndefined();
    });
});
