import { dataList } from '@presource/core';

/**
 * Contract source: `src/data/list.ts`.
 *
 * Callback payload is exactly `{ id, list, key, previous, value }` (list.ts:98-104):
 *  - `id`       → `path[0]`, the entry key at the root of the list (hoisted at list.ts:86)
 *  - `list`     → the ORIGINAL source object passed to `dataList` (identity, not a copy)
 *  - `key`      → dotted path of the assignment, including the entry id
 *  - `previous` → the value the assigned property held BEFORE the write (list.ts:102 `current`)
 *  - `value`    → the leaf value that was written
 *
 * Only `method === 'set'` traps fire callbacks (list.ts:81), and the structure lookup uses the
 * path with the entry id stripped (list.ts:120 / list.ts:136), so root-level assignments never
 * resolve a callback. Plain-object values are the only ones flattened (list.ts:115).
 */

/** Captures every callback invocation, including the exact argument object it received. */
const createRecorder = () => {
    const events: any[] = [];
    const record = (args: any) => events.push(args);
    return { events, record };
};

describe('Data List', () => {
    test('Simple List object creation and property access', () => {
        const source = {};
        // For Testing
        const keys: string[] = [];
        const values: string[] = [];
        const observe = (args: any) => {
            const { key, value } = args;
            // Record the value for matching
            keys.push(key);
            values.push(value);
        };

        // The Standard Structure
        const structure = {
            family: {
                mother: observe,
                father: observe
            },
            relative: {
                uncle: observe,
                aunty: observe
            }
        };

        // Creating a List
        const list = dataList(source, structure);
        list.naruto.family.mother = 'kushina';
        expect(list()).toBe(source);
        expect(source).toMatchObject({ naruto: { family: { mother: 'kushina' } } });
        expect(keys).toStrictEqual(['naruto.family.mother']);
    });

    test('Basic handler function access, getting source list', () => {
        const source = { existing: 1 };
        const list = dataList(source, { biography: { age: () => 0 } });

        // The proxy is callable and every call returns the raw source object unchanged.
        expect(typeof list).toBe('function');
        expect(list()).toBe(source);
        expect(list('ignored')).toBe(source);
        expect(list(0)).toBe(source);
        expect(list()).toBe(list());
    });

    test('Multi update via setting object data', () => {
        const source = {};
        const keys: string[] = [];
        const values: string[] = [];

        // The Observe function to see what is being triggered
        const observe = (args: any) => {
            const { key, value } = args;
            keys.push(key);
            values.push(value);
        };

        // Data Information
        const data = dataList(source, {
            biography: {
                age: observe,
                gender: observe
            }
        });

        // Single access
        data.jane.biography.age = 20;
        data.jane.biography.gender = 'female';
        // Setting it like so
        data.john.biography = { age: 10, gender: 'male' };

        data.bob = {
            biography: {
                age: 50,
                gender: 'none'
            }
        };

        expect(source).toMatchObject({
            jane: {
                biography: { age: 20, gender: 'female' }
            },
            john: {
                biography: { age: 10, gender: 'male' }
            },
            bob: {
                biography: {
                    age: 50,
                    gender: 'none'
                }
            }
        });

        expect(keys).toStrictEqual([
            'jane.biography.age',
            'jane.biography.gender',
            'john.biography.age',
            'john.biography.gender',
            'bob.biography.age',
            'bob.biography.gender'
        ]);

        expect(values).toStrictEqual([20, 'female', 10, 'male', 50, 'none']);
    });

    test('should skip non-function callbacks in structure', () => {
        const source = {};
        const triggered: string[] = [];
        const observe = (args: any) => {
            triggered.push(args.key);
        };

        // age has a non-function value, gender has a real callback
        const data = dataList(source, {
            biography: {
                age: 'not a function',
                gender: observe
            }
        });

        data.jane.biography.age = 30;
        data.jane.biography.gender = 'female';

        expect(source).toMatchObject({
            jane: { biography: { age: 30, gender: 'female' } }
        });

        // Only gender callback should fire
        expect(triggered).toStrictEqual(['jane.biography.gender']);
    });
});

describe('dataList callback payload', () => {
    test('should deliver the exact payload shape for a primitive assignment', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record, gender: record } });

        list.jane.biography.age = 20;

        // Full payload, exact keys and values — including the live source reference.
        expect(events).toStrictEqual([
            { id: 'jane', list: source, key: 'jane.biography.age', previous: undefined, value: 20 }
        ]);
        // The `list` argument is the same object identity, not a snapshot copy.
        expect(events[0].list).toBe(source);
    });

    test('should report the prior value in previous and the entry id at path root', () => {
        const source: any = { jane: { biography: { age: 20 } } };
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });

        list.jane.biography.age = 31;

        expect(events).toStrictEqual([
            { id: 'jane', list: source, key: 'jane.biography.age', previous: 20, value: 31 }
        ]);
    });

    // list.ts:115-128: an object value is flattened and each leaf fires separately, in the
    // insertion order of the assigned object (nested leaves last because objectScan descends in order).
    test('should fire one event per flattened leaf in insertion order for an object assignment', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, {
            biography: { age: record, gender: record, meta: { x: record } }
        });

        list.john.biography = { gender: 'male', age: 10, meta: { x: 7 } };

        expect(events.map((event) => [event.id, event.key, event.value])).toStrictEqual([
            ['john', 'john.biography.gender', 'male'],
            ['john', 'john.biography.age', 10],
            ['john', 'john.biography.meta.x', 7]
        ]);
        expect(source).toStrictEqual({ john: { biography: { gender: 'male', age: 10, meta: { x: 7 } } } });
    });

    // `previous` comes from the outer set trap, so every leaf of one object assignment reports
    // the SAME previous value: the entire previous entry object.
    test('should report the whole previous object as previous for every leaf of a re-assignment', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record, gender: record } });

        list.a.biography.age = 1;
        list.a.biography = { age: 2, gender: 'g' };

        expect(events).toStrictEqual([
            { id: 'a', list: source, key: 'a.biography.age', previous: undefined, value: 1 },
            { id: 'a', list: source, key: 'a.biography.age', previous: { age: 1 }, value: 2 },
            { id: 'a', list: source, key: 'a.biography.gender', previous: { age: 1 }, value: 'g' }
        ]);
    });

    // The assigned object is stored by reference — the observer does not clone it.
    test('should store an assigned object by reference without cloning', () => {
        const source: any = {};
        const { record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });
        const value = { age: 1 };

        list.a.biography = value;

        expect(source.a.biography).toBe(value);
    });
});

describe('dataList values that do not match a structure callback', () => {
    // Arrays hit the non-plain branch of list.ts:129-139 with a single-segment pointer, and the
    // extracted structure node is not a function, so nothing fires even though the write lands.
    test('should not fire for an array value but still write it to the source', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });

        list.a.tags = [1, 2];

        expect(events).toStrictEqual([]);
        expect(source).toStrictEqual({ a: { tags: [1, 2] } });
    });

    // A null leaf value is a primitive: the callback still runs with value === null.
    test('should fire with a null value for a matched leaf path', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { gender: record } });

        list.a.biography.gender = null;

        expect(events).toStrictEqual([
            { id: 'a', list: source, key: 'a.biography.gender', previous: undefined, value: null }
        ]);
    });

    // Assigning undefined CREATES the key on the source object (it is not a deletion).
    test('should create the key and fire with undefined value', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { gender: record } });

        list.a.biography.gender = undefined;

        expect(events).toStrictEqual([
            { id: 'a', list: source, key: 'a.biography.gender', previous: undefined, value: undefined }
        ]);
        expect('gender' in source.a.biography).toBe(true);
        expect(Object.keys(source.a.biography)).toStrictEqual(['gender']);
    });

    // Root-level assignment strips the id segment, leaving an empty pointer that extracts the
    // structure object itself — never a function, so no callback fires.
    test('should not fire for a root-level primitive assignment', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { name: record, biography: { age: record } });

        list.name = 'zed';

        expect(events).toStrictEqual([]);
        expect(source).toStrictEqual({ name: 'zed' });
    });

    test('should not fire for paths absent from the structure template', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });

        list.x.unknown = 5;
        list.x.biography = { age: 1, other: 2 };

        // Only the one matched leaf fires; `x.unknown` and `other` are silent.
        expect(events).toStrictEqual([
            { id: 'x', list: source, key: 'x.biography.age', previous: undefined, value: 1 }
        ]);
        expect(source).toStrictEqual({ x: { unknown: 5, biography: { age: 1, other: 2 } } });
    });

    // A function value is not a plain object, so it takes the single-callback branch
    // (list.ts:129-139) and is reported like any other leaf.
    test('should fire with a function value for a matched leaf path', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });
        const fn = () => 1;

        list.a.biography.age = fn;

        expect(events.length).toBe(1);
        expect(events[0].key).toBe('a.biography.age');
        expect(events[0].value).toBe(fn);
        expect(source.a.biography.age).toBe(fn);
    });
});

describe('dataList structure template stays live', () => {
    // The callback is resolved from the template on every mutation (objectExtract at
    // list.ts:96), so replacing a callback after `dataList` was created takes effect
    // immediately. This is the contract that rules out caching a resolved callback per pointer.
    test('should pick up a structure callback swapped after the list was created', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const structure = { biography: { age: record } };
        const list = dataList(source, structure);

        list.a.biography.age = 1;

        const swapped: string[] = [];
        structure.biography.age = (args: any) => swapped.push(args.key);
        list.a.biography.age = 2;

        // Only the first write reached the original recorder...
        expect(events).toStrictEqual([
            { id: 'a', list: source, key: 'a.biography.age', previous: undefined, value: 1 }
        ]);
        // ...and the replacement handles the next one, with the previous value of the write.
        expect(swapped).toStrictEqual(['a.biography.age']);
        expect(source).toStrictEqual({ a: { biography: { age: 2 } } });
    });
});

describe('dataList proxy read behaviour', () => {
    // objectObserve auto-vivifies missing keys on READ (observe.ts get trap) but the 'get' method
    // is ignored by dataList (list.ts:81), so no callback fires.
    test('should auto-vivify an empty object on reading a missing key without firing callbacks', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });

        const read = list.nope;

        expect(events).toStrictEqual([]);
        expect(source).toStrictEqual({ nope: {} });
        expect(typeof read).toBe('object');
    });

    // Every read of an object value hands back the SAME memoized wrapper (src/object/observe.ts
    // keeps one Proxy per raw object — intentional behaviour change for perf issue H4), and it
    // is never the raw nested object itself.
    test('should return the memoized proxy for object values and raw values for primitives', () => {
        const source: any = { a: { biography: { age: 5 } } };
        const { record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });

        expect(list.a).not.toBe(source.a);
        expect(list.a).toBe(list.a);
        // Primitive leaves are returned unwrapped.
        expect(list.a.biography.age).toBe(5);
    });

    // The proxy target is the handler function, so `in` / Object.keys never see list entries.
    test('should expose no own keys through the proxy even though the source has entries', () => {
        const source: any = { a: { biography: { age: 1 } } };
        const list = dataList(source, { biography: { age: () => 0 } });

        expect('a' in list).toBe(false);
        expect(Object.keys(list)).toStrictEqual([]);
        expect(Object.keys(list())).toStrictEqual(['a']);
    });
});

describe('dataList special keys and deletion', () => {
    // Numeric keys are stringified by the proxy and resolve to an empty structure pointer.
    test('should write a numeric key to the source without firing a callback', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });

        list[0] = 'zero';

        expect(events).toStrictEqual([]);
        expect(Object.keys(source)).toStrictEqual(['0']);
        expect(source['0']).toBe('zero');
    });

    // The non-plain branch (list.ts:129-139) calls path.join('.'), which throws for a symbol key
    // AFTER the value has already been written to the source under that symbol.
    test('should throw when a symbol key is assigned and still record it on the source', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });
        const key = Symbol('sym');

        expect(() => {
            list[key] = 'symbol-value';
        }).toThrow('Cannot convert a Symbol value to a string');

        expect(events).toStrictEqual([]);
        expect(source[key]).toBe('symbol-value');
        expect(Object.keys(source)).toStrictEqual([]);
    });

    // Top-level delete bypasses both traps (objectProxy has no deleteProperty handler), so the
    // source keeps the entry and no callback fires.
    test('should not delete a top-level entry and should not fire a callback', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });
        list.a.biography.age = 1;
        events.length = 0;

        expect(delete list.a).toBe(true);

        expect(source).toStrictEqual({ a: { biography: { age: 1 } } });
        expect(events).toStrictEqual([]);
    });

    // Deleting through a nested object proxy mutates the real object, but the observer only
    // reports 'set', so no callback is emitted for the removal.
    test('should remove a nested key from the source without firing a callback', () => {
        const source: any = {};
        const { events, record } = createRecorder();
        const list = dataList(source, { biography: { age: record } });
        list.a.biography.age = 1;
        events.length = 0;

        expect(delete list.a.biography.age).toBe(true);

        expect(source).toStrictEqual({ a: { biography: {} } });
        expect(events).toStrictEqual([]);
    });
});
