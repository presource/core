import { objectEnsures } from '@presource/core';

describe('Array Ensures: Ensuring a variable is an array', () => {
    test('All output should be an array', () => {
        expect(objectEnsures()).toStrictEqual({});
        expect(objectEnsures(1)).toStrictEqual({ 1: 1 });
        expect(objectEnsures('a')).toStrictEqual({ a: 'a' });
        expect(objectEnsures(null)).toStrictEqual({ null: null });
        // Same as if nothing is passed
        expect(objectEnsures(undefined)).toStrictEqual({});
        expect(objectEnsures([1, 2, 3])).toStrictEqual({ 0: 1, 1: 2, 2: 3 });
        expect(objectEnsures({ is: 'object' })).toStrictEqual({ is: 'object' });

        // Special Cases Function
        expect(objectEnsures(() => 'a')).toStrictEqual({ a: 'a' });
        expect(
            objectEnsures(() => ({
                is: 'nested'
            }))
        ).toStrictEqual({ is: 'nested' });
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/ensures.ts:25-49, dispatched by typeSwitch
    // (src/type/switch.ts) which resolves the bucket from the value's constructor name.
    // ----------------------------------------------------------------------------------------

    test('plain objects are returned by the same reference (no clone)', () => {
        const source = { a: 1, nested: { b: 2 } };
        const result = objectEnsures(source);

        expect(result).toBe(source);
        expect(result.nested).toBe(source.nested);
    });

    test('functions are invoked once and their return value is recursed', () => {
        let calls = 0;
        const counter = () => {
            calls++;
            return 'a';
        };

        expect(objectEnsures(counter)).toStrictEqual({ a: 'a' });
        expect(calls).toBe(1);

        // The recursion re-enters objectEnsures, so nested arrays/objects are converted too
        expect(objectEnsures(() => [1, 2])).toStrictEqual({ 0: 1, 1: 2 });
        expect(objectEnsures(() => () => 'deep')).toStrictEqual({ deep: 'deep' });
        expect(objectEnsures(() => undefined)).toStrictEqual({});
        expect(objectEnsures(() => null)).toStrictEqual({ null: null });

        // Recursion also preserves the same-reference rule for object results
        const produced = { is: 'same' };
        expect(objectEnsures(() => produced)).toBe(produced);
    });

    test('empty and sparse arrays only key the visited indexes', () => {
        expect(objectEnsures([])).toStrictEqual({});
        // The array branch uses forEach, which skips holes
        expect(objectEnsures([, 2])).toStrictEqual({ 1: 2 });
    });

    test('array element values are kept by reference', () => {
        const element = { deep: true };
        const result = objectEnsures([element]);

        expect(result).toStrictEqual({ 0: { deep: true } });
        expect(result[0]).toBe(element);
    });

    test('primitives are wrapped under their own string conversion', () => {
        expect(objectEnsures(5)).toStrictEqual({ 5: 5 });
        expect(objectEnsures('k')).toStrictEqual({ k: 'k' });
        expect(objectEnsures('')).toStrictEqual({ '': '' });
        expect(objectEnsures(true)).toStrictEqual({ true: true });
        expect(objectEnsures(false)).toStrictEqual({ false: false });
        expect(objectEnsures(NaN)).toStrictEqual({ NaN: NaN });
        expect(objectEnsures(Infinity)).toStrictEqual({ Infinity: Infinity });
        // Numbers are stringified by Number.prototype.toString, so exponent form is the key
        expect(objectEnsures(1e21)).toStrictEqual({ '1e+21': 1e21 });
    });

    test('null becomes the literal "null" key (no dedicated null case)', () => {
        // ensures.ts has no `null` bucket, so null falls through to the default wrapper
        const result = objectEnsures(null);
        expect(result).toStrictEqual({ null: null });
        expect(Object.keys(result)).toStrictEqual(['null']);
    });

    test('class instances fall to the default branch and key under Object.prototype.toString', () => {
        class Model {
            x = 1;
        }
        const instance = new Model();
        const result = objectEnsures(instance);

        // typeName() is "model", so neither the object nor the array branch runs
        expect(result).toStrictEqual({ '[object Object]': instance });
        expect(result['[object Object]']).toBe(instance);
    });

    test('symbols key under their description string', () => {
        const symbol = Symbol('tag');
        const result = objectEnsures(symbol);

        expect(result).toStrictEqual({ 'Symbol(tag)': symbol });
        expect(result['Symbol(tag)']).toBe(symbol);
    });

    test('objects without a prototype are misclassified as null', () => {
        // typeConstructor() reads `value?.constructor`, which is undefined for a bare object,
        // and typeSwitch then maps the empty type name to the "null" bucket
        const bare = Object.create(null) as { z: number };
        bare.z = 9;
        const result = objectEnsures(bare);

        // The bare object is wrapped, not returned: the key is the "null" sentinel string
        expect(Object.keys(result)).toStrictEqual(['null']);
        expect(result.null).toBe(bare);
        expect(result.null.z).toBe(9);
        expect(result === bare).toBe(false);
    });
});
