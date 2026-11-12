import { objectScan, objectTransform } from '@presource/core';

describe('objectTransform', () => {
    test('Simple transformation 1', () => {
        const input = { a: 'apple', b: 'banana' };
        const transformer = {
            a: ({ value }: any) => value + '1',
            b: ({ value }: any) => value + '2'
        };

        expect(objectTransform(input, transformer)).toStrictEqual({
            a: 'apple1',
            b: 'banana2'
        });
    });

    test('Simple transformation 2', () => {
        const input = { a: 'apple', b: 'banana' };
        const transformer = {
            c: 'cat',
            d: () => 'dog'
        };
        const output = objectTransform(input, transformer);

        expect(output).toStrictEqual({
            c: 'cat',
            d: 'dog'
        });

        expect({ ...input, ...output }).toStrictEqual({
            a: 'apple',
            b: 'banana',
            c: 'cat',
            d: 'dog'
        });
    });

    test('Simple transformation 3', () => {
        const input = { a: 'apple', b: 'banana' };
        const transform = {
            a: {
                1: 'a',
                2: 'p',
                3: 'p',
                4: 'l',
                5: 'e'
            }
        };
        // Get the output
        const output = objectTransform(input, transform);
        expect(output).toStrictEqual({
            a: { 1: 'a', 2: 'p', 3: 'p', 4: 'l', 5: 'e' }
        });
    });

    test('Basic access to nested data for transformation', () => {
        const input = { a: 'apple', b: 'banana', c: 'cat', d: 'dog' };
        const transformer = {
            level: ({ key, input }: any) => {
                // Expecting transformation
                expect(key).toBe('level');
                expect(input).toStrictEqual({ a: 'apple', b: 'banana', c: 'cat', d: 'dog' });
                return true;
            },
            nested: {
                one: (_: any, { key, input }: any) => {
                    // One level up
                    expect(key).toBe('nested');
                    expect(input).toStrictEqual({ a: 'apple', b: 'banana', c: 'cat', d: 'dog' });
                    return true;
                },
                two: () => true
            }
        };

        const output = objectTransform(input, transformer);
        expect(output).toStrictEqual({
            level: true,
            nested: {
                one: true,
                two: true
            }
        });
    });

    test('More complex nested data access', () => {
        // This is the input
        const input = {
            subjects: { math: { teachers: 2, students: 5 }, english: { teachers: 4, students: 10 } },
            electives: { biology: { teachers: 1, students: 5 }, chemistry: { teachers: 3, students: 4 } }
        };

        const output = objectTransform(input, {
            teachers: ({ input }) => {
                let count = 0;
                objectScan(input, ({ key, value }) => {
                    if (key === 'teachers') {
                        count += value;
                    }
                });
                return count;
            },
            students: ({ input }) => {
                let count = 0;
                objectScan(input, ({ key, value }) => {
                    if (key === 'students') {
                        count += value;
                    }
                });
                return count;
            }
        });

        expect(output).toStrictEqual({
            teachers: 10,
            students: 24
        });
    });

    test('Use transform to resolve values within object', () => {
        const output = objectTransform(
            {},
            {
                apple: ({ output }) => {
                    const { banana } = output;
                    if (banana) return 'apple';
                },
                banana: () => {
                    return 'banana';
                }
            }
        );

        expect(output).toStrictEqual({
            apple: 'apple',
            banana: 'banana'
        });
    });

    test('should break loop on self-referencing transform', () => {
        const output = objectTransform(
            {},
            {
                a: ({ output }) => {
                    if (output.a) return output.a;
                }
            }
        );

        expect(output).toStrictEqual({});
    });

    test('Dependent rules resolve across iterative passes', () => {
        // Declared in reverse dependency order: c needs b, b needs a
        const output = objectTransform(
            {},
            {
                c: ({ output }: any) => (output.b ? `c<-${output.b}` : undefined),
                b: ({ output }: any) => (output.a ? `b<-${output.a}` : undefined),
                a: () => 'a'
            }
        );

        // Pass 1 resolves only `a`, pass 2 resolves `b`, pass 3 resolves `c`
        expect(output).toStrictEqual({ a: 'a', b: 'b<-a', c: 'c<-b<-a' });
    });

    test('Output keys are inserted in resolution order, not declaration order', () => {
        const order: string[] = [];
        const output = objectTransform(
            {},
            {
                first: ({ output }: any) => {
                    order.push(`first:${Object.keys(output).join(',')}`);
                    return output.second ? 'F' : undefined;
                },
                second: ({ output }: any) => {
                    order.push(`second:${Object.keys(output).join(',')}`);
                    return 'S';
                }
            }
        );

        // `first` runs twice: pending on pass 1, resolved on pass 2 once `second` exists
        expect(order).toStrictEqual(['first:', 'second:', 'first:second']);
        expect(Object.keys(output)).toStrictEqual(['second', 'first']);
        expect(output).toStrictEqual({ second: 'S', first: 'F' });
    });

    test('Function rules receive exactly key, value, input and output', () => {
        const input = { a: 'A' };
        const argKeys: string[][] = [];
        const details: any[] = [];

        objectTransform(input, {
            a: (...args: any[]) => {
                const arg = args[0];
                argKeys.push(Object.keys(arg));
                details.push({
                    key: arg.key,
                    value: arg.value,
                    inputIsSource: arg.input === input,
                    outputKeysAtCall: Object.keys(arg.output),
                    // Top-level rules are called with a single argument (no layers to unwind)
                    argumentCount: args.length
                });
                return 'done';
            }
        });

        // Exactly one argument object, with exactly these four keys
        expect(argKeys).toStrictEqual([['key', 'value', 'input', 'output']]);
        expect(details).toStrictEqual([
            {
                key: 'a',
                value: 'A',
                inputIsSource: true,
                outputKeysAtCall: [],
                argumentCount: 1
            }
        ]);
    });

    test('Nested rules receive their own level first and the parent layers after', () => {
        const input = { deep: { inner: 7 } };
        const layers: any[] = [];

        const output = objectTransform(input, {
            deep: {
                inner: (...args: any[]) => {
                    // Each layer is snapshotted so live objects do not leak their final state
                    layers.push(args.map((arg, index) => ({
                        index,
                        key: arg.key,
                        value: arg.value,
                        inputKeys: Object.keys(arg.input),
                        outputKeys: Object.keys(arg.output)
                    })));
                    return 'x';
                }
            }
        });

        expect(layers).toStrictEqual([
            [
                { index: 0, key: 'inner', value: 7, inputKeys: ['inner'], outputKeys: [] },
                { index: 1, key: 'deep', value: { inner: 7 }, inputKeys: ['deep'], outputKeys: [] }
            ]
        ]);
        expect(output).toStrictEqual({ deep: { inner: 'x' } });
    });

    test('Three levels of nesting accumulate two parent layers', () => {
        const seen: string[][] = [];
        const output = objectTransform({ l1: { l2: { leaf: 3 } } }, {
            l1: {
                l2: {
                    leaf: (...args: any[]) => {
                        seen.push(args.map((arg) => arg.key));
                        return 'leaf';
                    }
                }
            }
        });

        // Innermost rule sees [own, parent, grandparent]
        expect(seen).toStrictEqual([['leaf', 'l2', 'l1']]);
        expect(output).toStrictEqual({ l1: { l2: { leaf: 'leaf' } } });
    });

    test('A rule that resolves to undefined stays pending and is absent from the output', () => {
        const output = objectTransform({ present: 1 }, {
            a: () => undefined,
            b: () => 2
        });

        expect(output).toStrictEqual({ b: 2 });
        // The pending key is never created at all (not even as undefined)
        expect(Object.keys(output)).toStrictEqual(['b']);
        expect('a' in output).toBe(false);
    });

    test('A self-referencing rule is attempted once and then abandoned', () => {
        let calls = 0;
        const output = objectTransform({}, {
            a: ({ output }: any) => {
                calls++;
                return output.a ? output.a : undefined;
            }
        });

        // The pass makes no progress, so the loop breaks instead of hanging
        expect(calls).toBe(1);
        expect(output).toStrictEqual({});
    });

    test('Several unresolved rules still terminate after a single pass', () => {
        let aCalls = 0;
        let bCalls = 0;
        const output = objectTransform({}, {
            a: ({ output }: any) => {
                aCalls++;
                return output.b ? `a${aCalls}` : undefined;
            },
            b: () => {
                bCalls++;
                return undefined;
            }
        });

        expect(aCalls).toBe(1);
        expect(bCalls).toBe(1);
        expect(output).toStrictEqual({});
    });

    test('Only undefined counts as pending - other falsy results are stored', () => {
        const output = objectTransform({}, {
            a: () => null,
            b: () => false,
            c: () => 0,
            d: () => ''
        });

        expect(output).toStrictEqual({ a: null, b: false, c: 0, d: '' });
    });

    test('Literal rules are copied verbatim and an undefined literal is dropped', () => {
        const output = objectTransform({}, {
            s: 'str',
            n: 0,
            bool: false,
            nul: null,
            und: undefined,
            nested: {}
        });

        // A `{}` rule is an object rule: it resolves to an empty object and is kept
        expect(output).toStrictEqual({ s: 'str', n: 0, bool: false, nul: null, nested: {} });
        expect(Object.keys(output)).toStrictEqual(['s', 'n', 'bool', 'nul', 'nested']);
    });

    test('A non-object input is replaced by an empty object', () => {
        // Numbers, strings and arrays all fail isObject(), so every rule sees an empty input
        expect(objectTransform(5 as any, { a: ({ value }: any) => value })).toStrictEqual({});
        expect(objectTransform('abc' as any, { a: ({ input }: any) => JSON.stringify(input) })).toStrictEqual({ a: '{}' });
        expect(objectTransform([1, 2] as any, { a: ({ input }: any) => Object.keys(input).length })).toStrictEqual({ a: 0 });
        // null behaves the same way and a literal rule is unaffected by the input
        expect(objectTransform(null as any, { a: () => 1 })).toStrictEqual({ a: 1 });
    });

    test('Rules for keys that are missing from the input still run with value undefined', () => {
        const output = objectTransform({ a: 1 }, {
            z: ({ value, input }: any) => `${String(value)}|${Object.keys(input).join(',')}`
        });

        expect(output).toStrictEqual({ z: 'undefined|a' });
    });

    test('A nested rule over a missing input branch receives an empty input', () => {
        const output = objectTransform({}, {
            nested: {
                x: ({ input, value, key }: any) => `${key}:${JSON.stringify(input)}:${String(value)}`
            }
        });

        // inputValue was undefined, so the nested pass starts from {}
        expect(output).toStrictEqual({ nested: { x: 'x:{}:undefined' } });
    });

    test('Nested pending rules are dropped from the nested result', () => {
        const output = objectTransform({ n: { x: 1 } }, {
            n: {
                x: () => undefined,
                y: () => 'Y'
            }
        });

        expect(output).toStrictEqual({ n: { y: 'Y' } });
        expect(Object.keys(output.n)).toStrictEqual(['y']);
    });

    test('An empty nested rule map still resolves to an empty object', () => {
        const output = objectTransform({ n: { x: 1 } }, { n: {} });

        // The nested pass has nothing pending, so it returns {} which is a defined value
        expect(output).toStrictEqual({ n: {} });
    });
});
