import { objectRegistry } from '@presource/core';

// Testing Object Registry
describe('Testing Object Registry', () => {
    // Creating a standard registry to test
    const registry = objectRegistry();

    test('Basic get and set functionality', () => {
        // Register entry one has the value of "1";
        registry('one', 1);
        registry('two', 2);
        expect(registry('one')).toBe(1);
        expect(registry('two')).toBe(2);
        expect(registry()).toEqual({ one: 1, two: 2 });
    });

    test('Multi Update Functionality. Use Object', () => {
        // Adding One and Two value into Registry. Overwriting previous
        registry({ one: 3, two: 4 });
        // Checking if it is true or not
        expect(registry('one')).toBe(3);
        expect(registry('two')).toBe(4);
        expect(registry()).toEqual({ one: 3, two: 4 });
    });

    test('Using array as key input', () => {
        // Overwriting Registry Object
        registry({ 1: 'one', 2: 'two', 3: 'three', 4: 'four' });
        // Use Array to Multi Select
        expect(registry([1, 2])).toEqual({ 1: 'one', 2: 'two' });
        expect(registry([3, 1])).toEqual({ 3: 'three', 1: 'one' });
    });

    test('String set returns the accessor itself so calls can be chained', () => {
        const store: any = {};
        const reg = objectRegistry(store);

        expect(reg('a', 1)).toBe(reg);
        // Every link returns the same accessor, so the chain keeps writing
        const chained = reg('b', 2)('c', 3);
        expect(chained).toBe(reg);
        expect(chained('a')).toBe(1);
        expect(store).toStrictEqual({ a: 1, b: 2, c: 3 });
    });

    test('An explicit undefined value means get, not set', () => {
        const store: any = { known: 'original' };
        const reg = objectRegistry(store);

        // `value === undefined` is the get signal, even when the argument is passed explicitly
        expect(reg('known', undefined)).toBe('original');
        expect(reg('missing', undefined)).toBeUndefined();
        expect(store).toStrictEqual({ known: 'original' });
        expect(Object.keys(store)).toStrictEqual(['known']);
    });

    test('Null is stored as a real value', () => {
        const store: any = {};
        const reg = objectRegistry(store);

        expect(reg('a', null)).toBe(reg);
        expect(store).toStrictEqual({ a: null });
        expect(reg('a')).toBeNull();
    });

    test('Number keys are delegated to the string key', () => {
        const store: any = {};
        const reg = objectRegistry(store);

        expect(reg(1, 'one')).toBe(reg);
        expect(reg(1)).toBe('one');
        // Property keys are always strings, so the number becomes "1"
        expect(Object.keys(store)).toStrictEqual(['1']);
        expect(store).toStrictEqual({ 1: 'one' });
    });

    test('Array argument projects the stored values, missing keys stay present as undefined', () => {
        const store = { 1: 'one', 2: 'two' };
        const reg = objectRegistry(store);

        const projected = reg([1, 2, 3]);

        // objectCreate always writes the key, so a miss produces an explicit undefined
        expect(projected).toStrictEqual({ 1: 'one', 2: 'two', 3: undefined });
        expect(Object.keys(projected)).toStrictEqual(['1', '2', '3']);
        // Projection is a read: the registry itself is untouched
        expect(store).toStrictEqual({ 1: 'one', 2: 'two' });
    });

    test('Array argument with mixed key types and an empty list', () => {
        const store = { a: 1, 1: 'numeric' };
        const reg = objectRegistry(store);

        expect(reg(['a', 1, 'nope'])).toStrictEqual({ a: 1, 1: 'numeric', nope: undefined });
        // An empty key list produces an empty object (and does not touch the store)
        expect(reg([])).toStrictEqual({});
    });

    test('Object argument merges into the registry and returns it', () => {
        const store: any = { cfg: { a: 1, b: 2 } };
        const reg = objectRegistry(store);

        // objectUpdate semantics: the raw registry is returned for chaining
        expect(reg({ x: 9, cfg: { a: 9 } })).toBe(store);
        // Nested values are overwritten wholesale, never deep merged
        expect(store).toStrictEqual({ cfg: { a: 9 }, x: 9 });
        expect(reg('cfg')).toStrictEqual({ a: 9 });
    });

    test('No argument (and any unmatched type) returns the raw registry object', () => {
        const store = { a: 1 };
        const reg = objectRegistry(store);

        // Identity: the live store object is handed back, not a copy
        expect(reg()).toBe(store);
        expect(reg(null as any)).toBe(store);
        expect(reg(undefined as any)).toBe(store);
        expect(reg(true as any)).toBe(store);
    });

    test('Each registry instance keeps its own default store', () => {
        const first = objectRegistry();
        const second = objectRegistry();

        first('x', 1);

        expect(first()).toStrictEqual({ x: 1 });
        expect(second()).toStrictEqual({});
        expect(first()).not.toBe(second());
    });

    test('Empty string is usable as a registry key', () => {
        const store: any = {};
        const reg = objectRegistry(store);

        reg('', 'empty-key');

        expect(reg('')).toBe('empty-key');
        expect(store).toStrictEqual({ '': 'empty-key' });
    });
});

// Testing Advance Functions, such as Handler
describe('Handler Functions', () => {
    const registry = objectRegistry({
        one: 'apple',
        two: 'banana',
        three: 'plum'
    });

    // This is to test the each handler function
    test('Each Function', () => {
        expect(
            // Expecting the return value to be 0
            registry(({ each }) => {
                // Return the value of each
                return each(({ key, index }) => {
                    // If Key is found, then return the index
                    if (key === 'one') return index;
                });
            })
        ).toBe(0);

        expect(
            // Expecting the return value to be 0
            registry(({ each }) => {
                // Return the Each Value
                return each(({ key, index }) => {
                    // If Key is found, then return the index
                    if (key === 'three') return index;
                });
            })
        ).toBe(2);
    });

    test('number key delegates to string', () => {
        const reg = objectRegistry({ 1: 'one', 2: 'two' });
        expect(reg(1 as any)).toBe('one');
    });

    test('default case returns registry', () => {
        const reg = objectRegistry({ a: 1 });
        expect(reg(null as any)).toEqual({ a: 1 });
        expect(reg(undefined as any)).toEqual({ a: 1 });
    });

    test('The handler receives exactly one helper: each', () => {
        const reg = objectRegistry({ a: 1 });

        expect(reg((handler: any) => Object.keys(handler))).toStrictEqual(['each']);
        // Whatever the handler returns is what the accessor returns
        expect(reg(() => 'handler-result')).toBe('handler-result');
    });

    test('each iterates every entry with the full objectEach payload', () => {
        const store = { one: 'a', two: 'b' };
        const reg = objectRegistry(store);
        const entries: any[] = [];
        let seenObject: any = null;

        const result = reg(({ each }) =>
            each((data: any) => {
                seenObject = data.object;
                entries.push({
                    array: [...data.array],
                    key: data.key,
                    value: data.value,
                    index: data.index,
                    length: data.length,
                    result: data.result,
                    isStore: data.object === store
                });
            })
        );

        // A callback that never returns a value iterates the whole registry
        expect(result).toBeUndefined();
        expect(entries).toStrictEqual([
            { array: ['one', 'two'], key: 'one', value: 'a', index: 0, length: 2, result: undefined, isStore: true },
            { array: ['one', 'two'], key: 'two', value: 'b', index: 1, length: 2, result: undefined, isStore: true }
        ]);
        expect(seenObject).toBe(store);
    });

    test('each short-circuits on the first non-undefined callback result', () => {
        const reg = objectRegistry({ one: 'a', two: 'b', three: 'c' });
        const visited: string[] = [];

        const result = reg(({ each }) =>
            each(({ key }) => {
                visited.push(key as string);
                return key === 'two' ? `stopped@${key}` : undefined;
            })
        );

        // The loop stops as soon as a truthy/defined result comes back
        expect(visited).toStrictEqual(['one', 'two']);
        expect(result).toBe('stopped@two');
    });

    test('each over an empty registry never fires and returns undefined', () => {
        const reg = objectRegistry({});
        let calls = 0;

        const result = reg(({ each }) => {
            each(() => {
                calls++;
            });
            return undefined;
        });

        expect(calls).toBe(0);
        expect(result).toBeUndefined();
    });
});
