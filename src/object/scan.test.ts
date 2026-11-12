import { isString, objectScan } from '@presource/core';

/**
 * Snapshot of one objectScan callback invocation.
 * `array`/`path` are copied because they are live internals of the underlying objectEach loop,
 * and `object`/`callback` are reduced to identity/type tags for exact whole-payload assertions.
 */
const snapshot = (args: any, target: object) => ({
    key: args.key,
    value: args.value,
    index: args.index,
    length: args.length,
    path: [...args.path],
    result: args.result,
    array: [...args.array],
    objectIsTarget: args.object === target,
    callbackIsFunction: typeof args.callback === 'function'
});

describe('Object Scan', () => {
    test('Basic object scanning', () => {
        const example = { a: 'apple', b: 'banana', c: 'cat', d: 'dog' };

        const result: string[] = [];
        objectScan(example, ({ value }) => {
            result.push(value);
        });

        // Automatically Check for Apple, Banana, Cat or Dog
        expect(result).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
    });

    test('Basic value replacement', () => {
        // Replacing value is possible with object scan functionality
        const example = { a: 'apple', b: 'banana', c: 'cat', d: 'dog' };
        objectScan(example, () => 'thing');

        // Replacing all item to things
        expect(example).toStrictEqual({ a: 'thing', b: 'thing', c: 'thing', d: 'thing' });
    });

    test('Deep Scanning', () => {
        const example = { family: { father: { name: 'John' }, mother: { name: 'Jane' } } };
        const result: any = {};

        // Object Flattening Example
        objectScan(example, ({ value, path, key }) => {
            if (isString(value)) {
                // You need to add the current key as well
                path.push(key);
                // Adding to Result
                result[path.join('.')] = value;
            }
        });

        expect(result).toStrictEqual({
            'family.father.name': 'John',
            'family.mother.name': 'Jane'
        });
    });

    test('Deep replacement', () => {
        const example = { family: { father: { name: 'John' }, mother: { name: 'Jane' } } };
        objectScan(example, ({ value }) => {
            if (isString(value)) return 'Unknown';
        });

        // Checking the example new value
        expect(example).toStrictEqual({ family: { father: { name: 'Unknown' }, mother: { name: 'Unknown' } } });
    });

    test('Callback receives the full iteration payload at every level', () => {
        const example = { a: { b: 1 }, arr: [1, 2], n: null };
        const records: any[] = [];
        const returned = objectScan(example, (args) => {
            records.push(snapshot(args, example));
        });

        // objectScan itself never returns a value
        expect(returned).toBeUndefined();
        // `arr` is a leaf (see dedicated test), so only 4 invocations happen
        expect(records).toStrictEqual([
            {
                key: 'a',
                value: { b: 1 },
                index: 0,
                length: 3,
                path: [],
                result: undefined,
                array: ['a', 'arr', 'n'],
                objectIsTarget: true,
                callbackIsFunction: true
            },
            {
                key: 'b',
                value: 1,
                index: 0,
                length: 1,
                path: ['a'],
                result: undefined,
                array: ['b'],
                objectIsTarget: false,
                callbackIsFunction: true
            },
            {
                key: 'arr',
                value: [1, 2],
                index: 1,
                length: 3,
                path: [],
                result: undefined,
                array: ['a', 'arr', 'n'],
                objectIsTarget: true,
                callbackIsFunction: true
            },
            {
                key: 'n',
                value: null,
                index: 2,
                length: 3,
                path: [],
                result: undefined,
                array: ['a', 'arr', 'n'],
                objectIsTarget: true,
                callbackIsFunction: true
            }
        ]);
        // `result` is the previous objectEach return; a defined value would have broken the loop
        expect(records[3].result).toBeUndefined();
    });

    test('Arrays are treated as leaves and are never recursed into', () => {
        const example = { list: [1, 2], name: 'x' };
        const keys: string[] = [];
        objectScan(example, ({ key, value }) => {
            keys.push(`${String(key)}:${JSON.stringify(value)}`);
        });

        // isObject() excludes arrays, so the array is reported whole and its items are not walked
        expect(keys).toStrictEqual(['list:[1,2]', 'name:"x"']);
        expect(example).toStrictEqual({ list: [1, 2], name: 'x' });
    });

    test('A top-level array is iterated by index and its object entries are recursed', () => {
        const example: any = [{ x: 1 }, 2];
        const records: any[] = [];
        objectScan(example, (args) => {
            records.push({
                key: args.key,
                value: args.value,
                index: args.index,
                length: args.length,
                path: [...args.path]
            });
        });

        // Object.keys on an array yields the numeric string keys, and path segments are strings
        expect(records).toStrictEqual([
            { key: '0', value: { x: 1 }, index: 0, length: 2, path: [] },
            { key: 'x', value: 1, index: 0, length: 1, path: ['0'] },
            { key: '1', value: 2, index: 1, length: 2, path: [] }
        ]);
    });

    test('The path array is a per-level copy, so mutating it does not leak to siblings', () => {
        const example = { a: { x: 1 }, b: { y: 2 } };
        const records: any[] = [];
        objectScan(example, ({ path, key }) => {
            // Recorded before mutation, mirroring what objectFlatten relies on
            records.push({ key, at: 'entry', path: [...path] });
            // Flatten-style mutation of the per-level copy
            path.push(key as string);
            records.push({ key, at: 'exit', path: [...path] });
        });

        // Each property gets a fresh slice of its parent's path, so the top-level sibling 'b'
        // is unaffected by the mutation performed for 'a'. The recursion appends the parent key
        // itself, which is why the mutated 'a' shows up twice inside the nested level.
        expect(records).toStrictEqual([
            { key: 'a', at: 'entry', path: [] },
            { key: 'a', at: 'exit', path: ['a'] },
            { key: 'x', at: 'entry', path: ['a', 'a'] },
            { key: 'x', at: 'exit', path: ['a', 'a', 'x'] },
            { key: 'b', at: 'entry', path: [] },
            { key: 'b', at: 'exit', path: ['b'] },
            { key: 'y', at: 'entry', path: ['b', 'b'] },
            { key: 'y', at: 'exit', path: ['b', 'b', 'y'] }
        ]);
    });

    test('A non-undefined return replaces the value in place and stops recursion for that subtree', () => {
        const example: any = { deep: { keep: 1 }, other: 2 };
        const visited: string[] = [];
        objectScan(example, ({ key, path }) => {
            visited.push([...path, String(key)].join('.'));
            if (key === 'deep') return { replaced: true };
        });

        // 'deep.keep' is never visited because the replacement short-circuits that subtree
        expect(visited).toStrictEqual(['deep', 'other']);
        expect(example).toStrictEqual({ deep: { replaced: true }, other: 2 });
    });

    test('Returning undefined keeps recursing into nested objects', () => {
        const example = { deep: { keep: 1 } };
        const visited: string[] = [];
        objectScan(example, ({ key, path }) => {
            visited.push([...path, String(key)].join('.'));
        });

        expect(visited).toStrictEqual(['deep', 'deep.keep']);
        expect(example).toStrictEqual({ deep: { keep: 1 } });
    });

    test('Falsy replacement values still replace the original', () => {
        const example: any = { nul: 'a', zero: 'b', empty: 'c', no: 'd', gone: 'e' };
        // Only an undefined return means "keep the value"; every other falsy value still replaces
        const replacements: any = { nul: null, zero: 0, empty: '', no: false };
        objectScan(example, ({ key }) => replacements[key]);

        expect(example).toStrictEqual({ nul: null, zero: 0, empty: '', no: false, gone: 'e' });
    });

    test('Replacing a nested leaf with an object does not rescan the new subtree', () => {
        const example: any = { a: { b: 1 } };
        const visited: string[] = [];
        objectScan(example, ({ key }) => {
            visited.push(String(key));
            if (key === 'b') return { deep: 2 };
        });

        // The replacement is written, but 'deep' is never visited (the guard compares the old value)
        expect(visited).toStrictEqual(['a', 'b']);
        expect(example).toStrictEqual({ a: { b: { deep: 2 } } });
    });

    test('An empty object never fires the callback', () => {
        let calls = 0;
        const returned = objectScan({}, () => {
            calls++;
            return 'ignored';
        });

        expect(calls).toBe(0);
        expect(returned).toBeUndefined();
    });

    test('A self-referencing object overflows the stack, unlike what the scan.ts:43-44 comment claims', () => {
        // G6: the JSDoc at scan.ts:43-44 promises "preventing infinite loops on circular
        // re-assignments", but the guard at scan.ts:70 only skips recursion when the callback
        // REPLACED the value. An untouched `a.self = a` still satisfies `value === object[key]`,
        // so the walk re-enters forever and the engine throws RangeError. No seen-set is tracked
        // (adding one would change the traversal contract, so it is deliberately left as-is).
        const cyclic: any = {};
        cyclic.self = cyclic;

        expect(() => objectScan(cyclic, () => undefined)).toThrow(RangeError);

        // The behaviour the comment actually describes: replacing on the way in breaks the chain
        // because the old value no longer matches what is stored, so that subtree is not entered.
        const replaced: any = {};
        replaced.self = replaced;
        objectScan(replaced, () => 'stop');

        expect(replaced).toStrictEqual({ self: 'stop' });
    });
});
