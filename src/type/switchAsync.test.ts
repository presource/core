import { typeSwitchAsync } from '@presource/core';

describe('Type Switch in Async format', () => {
    test('Value is returned correctly with undefined', async () => {
        const result = await typeSwitchAsync(undefined, {
            undefined: async () => 'invalid'
        });
        expect(result).toBe('invalid');
    });

    test('value is returned correctly with null', async () => {
        const result = await typeSwitchAsync(null, {
            null: async () => 'invalid'
        });
        expect(result).toBe('invalid');
    });
});

describe('Type Switch Checking', () => {
    // Checking if Type is Correct
    test('Checking type returned correctly', async () => {
        // Checking String Type
        expect(
            await typeSwitchAsync('string', {
                string: async ({ value }) => value
            })
        ).toBe('string');

        // Object Type
        expect(
            await typeSwitchAsync(
                { a: 'a' },
                {
                    object: async ({ value }) => value.a
                }
            )
        ).toBe('a');

        // Not Found. Undefined
        expect(await typeSwitchAsync('a', { default: async ({ value }) => value })).toBe('a');
    });

    // Checking the nested type are correct
    test('Checking nested type are correct', async () => {
        // Checking String
        await typeSwitchAsync('string', {
            string: async ({ value }) => {
                expect(value).toBe('string');
            }
        });
        // Checking for Number
        await typeSwitchAsync(10, {
            number: async ({ value }) => {
                expect(value).toBe(10);
            }
        });
        // Checking for Boolean
        await typeSwitchAsync(true, {
            boolean: ({ value }) => {
                expect(value).toBe(true);
            }
        });
        await typeSwitchAsync(false, {
            boolean: ({ value }) => {
                expect(value).toBe(false);
            }
        });

        // Checking for Function
        const func = () => {};
        await typeSwitchAsync(func, {
            function: ({ value }) => {
                expect(value).toEqual(func);
            }
        });
    });

    test('Number route switching', async () => {
        // Number switching route
        expect(
            await typeSwitchAsync('string', {
                number: ({ value }) => value,
                string: async ({ number }) => number(5)
            })
        ).toBe(5);

        // Route using the full nested callback name
        expect(
            await typeSwitchAsync('string', {
                number: ({ value }) => value,
                string: async ({ number }) => number(5)
            })
        ).toBe(5);
    });

    // Switching Routs
    test('Boolean route switching', async () => {
        // Boolean route switching
        expect(
            await typeSwitchAsync('string', {
                boolean: ({ value }) => value,
                string: ({ boolean }) => boolean(true)
            })
        ).toBe(true);

        // Boolean route switching using the full nested callback name
        expect(
            await typeSwitchAsync('string', {
                boolean: ({ value }) => value,
                string: ({ boolean }) => boolean(false)
            })
        ).toBe(false);
    });

    test('non-function case value returned directly', async () => {
        const result = await typeSwitchAsync('hello', {
            string: 'it is a string'
        });
        expect(result).toBe('it is a string');
    });

    test('default fallback with non-function value', async () => {
        const result = await typeSwitchAsync(42, {
            default: 'fallback value'
        });
        expect(result).toBe('fallback value');
    });

    // ------------------------------------------------------------------
    // Async contract: the dispatcher is an `async` function, so every
    // outcome (including a raw non-function case value) is wrapped in a promise.
    // ------------------------------------------------------------------
    test('always returns a promise, even for raw case values', async () => {
        const raw = typeSwitchAsync('x', { string: 'RAW' });
        expect(raw).toBeInstanceOf(Promise);
        expect(await raw).toBe('RAW');

        const unmatched = typeSwitchAsync(new Date(0), { string: () => 'S' });
        expect(unmatched).toBeInstanceOf(Promise);
        expect(await unmatched).toBeUndefined();
    });

    // Full dispatch matrix mirroring the synchronous variant.
    test('routes every case key and awaits async handlers', async () => {
        expect(await typeSwitchAsync('s', { string: async ({ value }) => `STR:${value}` })).toBe('STR:s');
        expect(await typeSwitchAsync(7, { number: async ({ value }) => `NUM:${value}` })).toBe('NUM:7');
        expect(await typeSwitchAsync(true, { boolean: async ({ value }) => `BOOL:${value}` })).toBe('BOOL:true');
        expect(await typeSwitchAsync([1, 2], { array: async ({ value }) => `ARR:${JSON.stringify(value)}` })).toBe(
            'ARR:[1,2]'
        );
        expect(await typeSwitchAsync({ a: 1 }, { object: async ({ value }) => `OBJ:${JSON.stringify(value)}` })).toBe(
            'OBJ:{"a":1}'
        );
        expect(
            await typeSwitchAsync(
                function named() {},
                { function: async ({ value }) => `FN:${typeof value}:${value.name}` }
            )
        ).toBe('FN:function:named');
        expect(await typeSwitchAsync(undefined, { undefined: async () => 'UND' })).toBe('UND');
        expect(await typeSwitchAsync(null, { null: async () => 'NUL' })).toBe('NUL');
        expect(
            await typeSwitchAsync(new Date(0), { default: async ({ value }) => `DEF:${value.toISOString()}` })
        ).toBe('DEF:1970-01-01T00:00:00.000Z');
        expect(await typeSwitchAsync(Symbol('q'), { default: async ({ value }) => `DEF:${String(value)}` })).toBe(
            'DEF:Symbol(q)'
        );
    });

    // Sync handlers are supported too: `await` simply resolves the plain return value.
    test('awaits plain (non-async) handlers the same way', async () => {
        expect(await typeSwitchAsync('s', { string: ({ value }) => `STR:${value}` })).toBe('STR:s');
        expect(await typeSwitchAsync(7, { number: ({ value }) => value + 1 })).toBe(8);
    });

    // A case entry that is not a function is returned verbatim, without awaiting anything.
    test('returns non-function case values as-is', async () => {
        expect(await typeSwitchAsync('x', { string: 'RAW-STRING-VALUE' })).toBe('RAW-STRING-VALUE');
        expect(await typeSwitchAsync(1, { number: 99 })).toBe(99);
        expect(await typeSwitchAsync(true, { boolean: false })).toBe(false);
        expect(await typeSwitchAsync(null, { null: null })).toBe(null);
        expect(await typeSwitchAsync([], { array: { hit: true } })).toStrictEqual({ hit: true });
    });

    // No matching key and no `default` key resolves to undefined.
    test('resolves undefined when nothing matches and there is no default', async () => {
        expect(await typeSwitchAsync(new Date(0), { string: () => 'S' })).toBeUndefined();
        expect(await typeSwitchAsync('x', {})).toBeUndefined();
        expect(await typeSwitchAsync('x', ['a', 'b'] as any)).toBeUndefined();
    });

    // Handler args mirror the sync variant: `value` plus one async helper per declared key.
    test('injects exactly one nested helper per declared case key', async () => {
        expect(await typeSwitchAsync('x', { string: (args) => Object.keys(args) })).toStrictEqual(['value', 'string']);
        expect(await typeSwitchAsync(null, { null: (args) => Object.keys(args) })).toStrictEqual(['value', 'null']);
        expect(await typeSwitchAsync(undefined, { undefined: (args) => Object.keys(args) })).toStrictEqual([
            'value',
            'undefined'
        ]);
        expect(
            await typeSwitchAsync('x', {
                string: (args: any) => Object.keys(args),
                date: () => 'D',
                wat: () => 'W'
            })
        ).toStrictEqual(['value', 'string', 'date', 'wat']);
    });

    // null-prototype objects report an empty type name and are resolved to the 'null' case.
    test('routes null-prototype objects to the null case', async () => {
        expect(
            await typeSwitchAsync(Object.create(null), { null: async () => 'NULLCASE', default: async () => 'DEFAULT' })
        ).toBe('NULLCASE');
        expect(await typeSwitchAsync(Object.create(null), { object: () => 'OBJECTCASE', default: () => 'DEF' })).toBe(
            'DEF'
        );
    });

    // ------------------------------------------------------------------
    // Nested delegation: each helper is an async callback that re-invokes the
    // target handler with `{ ...args, value: val }`.
    // ------------------------------------------------------------------
    test('nested async helper awaits the delegated handler', async () => {
        expect(
            await typeSwitchAsync('A', {
                string: async (args: any) => (args.value === 'A' ? await args.number(1) : `S:${args.value}`),
                number: async (args: any) => await args.string('B')
            })
        ).toBe('S:B');

        // Single hop, awaited
        expect(
            await typeSwitchAsync('outer', {
                number: async ({ value }) => `N:${value}`,
                string: async ({ number }) => await number(5)
            })
        ).toBe('N:5');

        // The nested helper always returns a promise, so an unawaited outer handler still
        // resolves because the dispatcher itself awaits the handler result.
        expect(
            await typeSwitchAsync('outer', {
                number: (args: any) => `N:${args.value}`,
                string: (args: any) => args.number(1)
            })
        ).toBe('N:1');

        // Only the first forwarded argument is used
        expect(
            await typeSwitchAsync('outer', {
                number: ({ value }) => value,
                string: async ({ number }) => await number(1, 2, 3)
            })
        ).toBe(1);

        // Missing arguments forward as undefined
        expect(
            await typeSwitchAsync('outer', {
                number: ({ value }) => `N:${JSON.stringify(value)}`,
                string: async ({ number }) => await number()
            })
        ).toBe('N:undefined');
    });

    // Nested helpers for the remaining case kinds.
    test('supports nested delegation for all remaining case kinds', async () => {
        expect(
            await typeSwitchAsync('x', {
                null: async ({ value }) => `N:${JSON.stringify(value)}`,
                undefined: async ({ value }) => `U:${JSON.stringify(value)}`,
                string: async ({ null: nullHelper, undefined: undefinedHelper }) => [
                    await nullHelper(null),
                    await undefinedHelper(undefined)
                ]
            })
        ).toStrictEqual(['N:null', 'U:undefined']);

        expect(
            await typeSwitchAsync('x', {
                array: async ({ value }) => `ARR:${JSON.stringify(value)}`,
                object: async ({ value }) => `OBJ:${JSON.stringify(value)}`,
                function: async ({ value }) => `FN:${await (value as any)()}`,
                string: async ({ array, object, function: functionHelper }) => [
                    await array([1]),
                    await object({ z: 1 }),
                    await functionHelper(async () => 'called')
                ]
            })
        ).toStrictEqual(['ARR:[1]', 'OBJ:{"z":1}', 'FN:called']);

        expect(
            await typeSwitchAsync('x', {
                default: async ({ value }) => `DEF:${JSON.stringify(value)}`,
                string: async ({ default: defaultHelper }) => await defaultHelper('via-default')
            })
        ).toBe('DEF:"via-default"');
    });

    // Helpers only exist for declared keys, so referencing an absent case rejects.
    test('rejects when delegating to a case key that was never declared', async () => {
        await expect(typeSwitchAsync('x', { string: ({ number }: any) => number(5) })).rejects.toThrow(TypeError);
        await expect(typeSwitchAsync('x', { string: (args: any) => args.default(1) })).rejects.toThrow(
            /is not a function/
        );
    });
});

/**
 * Perf-wave contract pins for the async dispatcher (T-A).
 *
 * Mirrors the sync contract: the args object is built eagerly (one ASYNC closure
 * per own enumerable case key, `value` first), the nested helpers still return
 * promises, and a non-callable nested case still rejects with the exact
 * `caseHandler is not a function` TypeError. Verified byte-for-byte against the
 * git HEAD async implementation by the 480-check legacy/current fingerprint parity
 * run and the cumulative mutation probes in Temp/coding-dispatch.
 */
describe('Type Switch Async Args Shape And Dispatch Side Effects', () => {
    test('Awaited handler receives the same eager args shape', async () => {
        let args: any;

        await typeSwitchAsync(42, {
            number: async (received: any) => {
                args = received;
            },
            string: () => 's'
        } as any);

        expect(Object.keys(args)).toEqual(['value', 'number', 'string']);
        expect(Object.getOwnPropertySymbols(args)).toEqual([]);
        expect({ ...args }).toEqual({ value: 42, number: expect.any(Function), string: expect.any(Function) });
    });

    test('Integer case keys enumerate first, then value, then the declared case order', async () => {
        class a {}

        const keys = await typeSwitchAsync(new a(), {
            2: () => 'two',
            a: (args: any) => Object.keys(args),
            string: () => 's',
            B: () => 'b'
        } as any);

        expect(keys).toEqual(['2', 'value', 'a', 'string', 'B']);
    });

    test('Nested helpers still return promises and resolve to the delegated result', async () => {
        let delegated: any;

        await typeSwitchAsync(42, {
            number: (args: any) => {
                delegated = args.string('x');
                return delegated;
            },
            string: async ({ value }: any) => `s=${value}`
        } as any);

        expect(delegated instanceof Promise).toBe(true);
        expect(await delegated).toBe('s=x');
    });

    test('A non-callable nested case rejects with the caseHandler TypeError', async () => {
        await expect(typeSwitchAsync(42, { number: (args: any) => args.string('x'), string: 'static' } as any)).rejects.toThrow('caseHandler is not a function');
    });

    test('A nullish nested case value resolves to undefined', async () => {
        expect(await typeSwitchAsync(42, { number: (args: any) => args.date(), date: null } as any)).toBeUndefined();
    });

    test('A static case reads only the matched case value and never builds args', async () => {
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

        expect(await typeSwitchAsync(42, cases as any)).toBe(99);
        expect(reads).toEqual(['number']);
    });

    test('Handlers may delete and add args members; added keys enumerate last', async () => {
        expect(await typeSwitchAsync(42, { number: async (args: any) => { delete args.string; return ['string' in args, typeof args.string]; }, string: () => 's' } as any)).toEqual([false, 'undefined']);
        expect(await typeSwitchAsync(42, { number: async (args: any) => { args.extra = 'E'; return Object.keys(args); }, string: () => 's' } as any)).toEqual(['value', 'number', 'string', 'extra']);
    });
});
