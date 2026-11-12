import { objectFlatten, objectUnflatten } from '@presource/core';

describe('Object flatten', () => {
    test('Basic object flattening', () => {
        // Setting an Example
        const example = { fruits: { apple: 1, banana: 2 }, animals: { cat: 1, dog: 2 } };

        // Checking Example Flattening
        expect(objectFlatten(example)).toStrictEqual({
            'fruits.apple': 1,
            'fruits.banana': 2,
            'animals.cat': 1,
            'animals.dog': 2
        });
    });

    test('Empty key should not be added as trailing', () => {
        const example = { classes: { '': 'astrid', students: ['will', 'sandy', 'thomas'] } };

        // Checking the Flattened Result
        expect(objectFlatten(example)).toStrictEqual({
            classes: 'astrid',
            'classes.students': ['will', 'sandy', 'thomas']
        });
    });

    test('Using keyValue callback', () => {
        const example = { classes: { '': 'astrid', students: ['will', 'sandy', 'thomas'] } };
        // Flattening by Stripping
        const result = objectFlatten(example, { key: ({ key, path }) => (key ? key : '') });

        // Expecting the Flattened Result to be the following
        expect(result).toStrictEqual({
            classes: 'astrid',
            students: ['will', 'sandy', 'thomas']
        });
    });

    test('A value callback can never flatten a leaf to a falsy value', () => {
        // G8: flatten.ts:78 is `callback?.value?.(value) || value`, so every falsy result
        // (0 / '' / false / null / undefined) falls back to the original leaf value. The only
        // way to change a leaf is to return something truthy.
        for (const replacement of [0, '', false, null, undefined]) {
            expect(objectFlatten({ a: 1, b: 2 }, { value: () => replacement as any } as any)).toStrictEqual({ a: 1, b: 2 });
        }

        // A truthy result does replace every leaf, and dotted keys are still joined
        expect(objectFlatten({ a: 1, b: { c: 2 } }, { value: () => 'mapped' })).toStrictEqual({ a: 'mapped', 'b.c': 'mapped' });
    });

    test('The value callback receives the raw leaf value while the key callback receives Arguments', () => {
        // G8: the `Callback` type declares an `Arguments` parameter for both callbacks, but the
        // implementation hands the whole scan payload to `key` (flatten.ts:77) and only the raw
        // leaf value to `value` (flatten.ts:78). Object branches are walked through, so only
        // leaves ever reach either callback.
        const valuePayloads: unknown[] = [];
        const keyPayloads: unknown[] = [];

        const result = objectFlatten(
            { a: 1, b: { c: 2 } },
            {
                key: (args: any) => {
                    // Snapshot the payload fields that identify the scan position
                    keyPayloads.push({ key: args.key, value: args.value, path: [...args.path] });
                    // A falsy key result falls back to the joined path
                    return undefined as any;
                },
                value: (arg: unknown) => {
                    valuePayloads.push(arg);
                    return 'mapped';
                }
            } as any
        );

        expect(valuePayloads).toStrictEqual([1, 2]);
        expect(keyPayloads).toStrictEqual([
            { key: 'a', value: 1, path: ['a'] },
            { key: 'c', value: 2, path: ['b', 'c'] }
        ]);
        expect(result).toStrictEqual({ a: 'mapped', 'b.c': 'mapped' });
    });

    test('Empty nested objects vanish because only leaves are emitted', () => {
        // G9: `objectScan` visits properties, but flatten only writes an entry for a non-object
        // value, so a branch with no leaf at all (`{}` and `{ c: {} }`) contributes nothing.
        // The flatten -> unflatten round-trip therefore cannot restore the source.
        const source = { a: {}, b: { c: {} }, d: 1 };

        const flat = objectFlatten(source);

        expect(flat).toStrictEqual({ d: 1 });
        expect(objectUnflatten(flat)).toStrictEqual({ d: 1 });
        expect(objectUnflatten(flat)).not.toStrictEqual(source);
    });
});
