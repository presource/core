import { objectTrigger } from '@presource/core';

describe('Object Trigger', () => {
    test('Basic trigger', () => {
        const data = { apple: 1, banana: 2 };
        let counter = 0;
        const result = objectTrigger(data, {
            // If there is apple, it will trigger this
            apple: () => {
                counter++;
            }
        });

        // If system returns nothing. Only banana is left.
        expect(result).toStrictEqual({ banana: 2 });
        expect(counter).toBe(1);
    });

    test('Can be used to construct new object based on old one', () => {
        const data = { apple: '1', banana: '2' };
        // The Output should be the following
        expect({ apple: '1', banana: 'done' }).toStrictEqual(
            // Constructing Object
            objectTrigger(data, {
                banana: () => {
                    return { banana: 'done' };
                }
            })
        );

        // The Output should be the following
        expect({ apple: '1', orange: '2' }).toStrictEqual(
            // Constructing Object
            objectTrigger(data, {
                banana: () => {
                    return { orange: '2' };
                }
            })
        );
    });

    test('Only object returns are merged; every other return is dropped', () => {
        const data = { apple: 1, banana: 2, cherry: 3 };
        // isObject() only accepts plain objects, so arrays and primitives never reach the output
        const returns: { [key: string]: any } = {
            string: 'str',
            number: 5,
            null: null,
            undefined: undefined,
            array: [1, 2],
            boolean: true,
            emptyObject: {}
        };

        const results: any = {};
        Object.keys(returns).forEach((label) => {
            results[label] = objectTrigger(data, { apple: () => returns[label] });
        });

        expect(results).toStrictEqual({
            string: { banana: 2, cherry: 3 },
            number: { banana: 2, cherry: 3 },
            null: { banana: 2, cherry: 3 },
            undefined: { banana: 2, cherry: 3 },
            array: { banana: 2, cherry: 3 },
            boolean: { banana: 2, cherry: 3 },
            emptyObject: { banana: 2, cherry: 3 }
        });

        // A plain object return is merged into the output alongside the untouched keys
        expect(objectTrigger(data, { apple: () => ({ extra: 'yes' }) })).toStrictEqual({
            extra: 'yes',
            banana: 2,
            cherry: 3
        });
    });

    test('A dropped return still removes the triggered key', () => {
        const data = { apple: 1, banana: 2 };
        // The triggered key is never copied, even though the value exists in the input
        expect(objectTrigger(data, { apple: () => 'ignored' })).toStrictEqual({ banana: 2 });
    });

    test('Trigger payload exposes exactly value, key, input and output', () => {
        const input = { a: 1, b: 2 };
        const payloads: any[] = [];

        const output = objectTrigger(input, {
            a: (args) => {
                payloads.push({ keys: Object.keys(args), value: args.value, key: args.key, inputIsSource: args.input === input, outputKeys: Object.keys(args.output) });
                return { a: 'changed' };
            },
            b: (args) => {
                payloads.push({ keys: Object.keys(args), value: args.value, key: args.key, inputIsSource: args.input === input, outputKeys: Object.keys(args.output) });
                return { b: args.output.a };
            }
        });

        expect(payloads).toStrictEqual([
            { keys: ['value', 'key', 'input', 'output'], value: 1, key: 'a', inputIsSource: true, outputKeys: [] },
            { keys: ['value', 'key', 'input', 'output'], value: 2, key: 'b', inputIsSource: true, outputKeys: ['a'] }
        ]);
        // The accumulator handed to each trigger is the live output being built
        expect(output).toStrictEqual({ a: 'changed', b: 'changed' });
    });

    test('Untouched keys are copied verbatim into a brand new object', () => {
        const nested = { deep: 1 };
        const input = { keep: nested, drop: 'x' };

        const output = objectTrigger(input, { drop: () => undefined });

        // Same nested reference, new container, source untouched
        expect(output).toStrictEqual({ keep: nested });
        expect(output).not.toBe(input);
        expect(output.keep).toBe(nested);
        expect(input).toStrictEqual({ keep: nested, drop: 'x' });
    });

    test('A later untriggered key overwrites what an earlier trigger returned', () => {
        const output = objectTrigger({ a: 1, b: 2 }, { a: () => ({ b: 'from-a' }) });

        // `b` is copied after `a` fired, so the plain copy wins
        expect(output).toStrictEqual({ b: 2 });
    });

    test('Trigger output keys keep the order in which the triggers ran', () => {
        const output = objectTrigger({ b: 2, a: 1 }, {
            a: () => ({ b: 'from-a' }),
            b: () => ({ c: 'from-b' })
        });

        // `b` runs first (input order), writing c; then `a` writes b
        expect(Object.keys(output)).toStrictEqual(['c', 'b']);
        expect(output).toStrictEqual({ c: 'from-b', b: 'from-a' });
    });

    test('Object returns are shallow merged only', () => {
        const output = objectTrigger({ a: 1, b: 2 }, {
            a: () => ({ shared: { x: 1 } }),
            b: () => ({ shared: { y: 2 } })
        });

        // objectUpdate overwrites wholesale: no deep merge of `shared`
        expect(output).toStrictEqual({ shared: { y: 2 } });
    });

    test('Mutating the output accumulator directly is preserved', () => {
        const output = objectTrigger({ a: 1, b: 2 }, {
            a: ({ output: accumulator }) => {
                accumulator.pre = 'set';
                return { via: 'return' };
            }
        });

        expect(output).toStrictEqual({ pre: 'set', via: 'return', b: 2 });
    });

    test('Empty input and empty trigger map', () => {
        expect(objectTrigger({}, { a: () => ({}) })).toStrictEqual({});
        // With no triggers every key is simply copied
        expect(objectTrigger({ a: 1 }, {})).toStrictEqual({ a: 1 });
    });
});
