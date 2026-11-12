import { dataClone, objectObserve } from '@presource/core';

/**
 * Normalizes one observe-callback payload into a plain, assertable snapshot.
 *
 * `object` is a live reference to the raw (un-proxied) level object, so it is reduced to a
 * boolean tag here; its exact identity is asserted separately with `toBe` when it matters.
 * `path` is copied because the callback receives the same array instance the observer uses
 * for the next nesting level.
 */
const snapshot = (args: any, target: object) => ({
    key: args.key,
    value: args.value,
    current: args.current,
    objectIsTarget: args.object === target,
    method: args.method,
    depth: args.depth,
    path: [...args.path]
});

describe('Object Observe', () => {
    test('Observation test for primitive', () => {
        const keys: string[] = [];
        const values: string[] = [];
        const source: any = {};
        const data = objectObserve(source, (data) => {
            keys.push(data.key);
            values.push(data.value);
        });

        data.fruit = 'apple';
        // The write must land on the raw target, and only one (set) event may fire
        expect(source).toStrictEqual({ fruit: 'apple' });
        expect(keys).toStrictEqual(['fruit']);
        expect(values).toStrictEqual(['apple']);
    });

    test('Set payload carries the full context for a primitive write', () => {
        const source: any = {};
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        data.fruit = 'apple';

        // Full payload contract for a `set`: previous value (`current`) is undefined for a new key
        expect(payloads).toStrictEqual([
            {
                key: 'fruit',
                value: 'apple',
                current: undefined,
                objectIsTarget: true,
                method: 'set',
                depth: 0,
                path: ['fruit']
            }
        ]);
        // The callback receives the raw object, never the proxy
        expect(payloads[0].current).toBeUndefined();
    });

    test('Observed preloaded data', () => {
        const source = {
            subjects: {
                english: 10,
                math: 12
            }
        };

        const currentValues: any[] = [];
        const updateValues: any[] = [];
        const data = objectObserve(source, ({ value, current, method }) => {
            if (method === 'set') {
                // Only Set should be looked at
                currentValues.push(current);
                updateValues.push(value);
            }
        });

        data.subjects.english = 20;
        data.subjects.math = 1;

        // The source should be updated correctly
        expect(source).toStrictEqual({ subjects: { english: 20, math: 1 } });
        expect(currentValues).toStrictEqual([10, 12]);
        expect(updateValues).toStrictEqual([20, 1]);
    });

    test('Nested Observation Check', () => {
        const source = {};
        const depths: number[] = [];
        const keys: string[] = [];
        const values: string[] = [];
        const methods: string[] = [];
        const paths: any[] = [];
        let counter = 0;
        const data = objectObserve(source as any, ({ key, value, depth, method, path }) => {
            depths.push(depth);
            keys.push(key);
            values.push(dataClone(value));
            methods.push(method);
            paths.push(path);
            counter++;
        });

        data.fruit.apple = 1;
        data.fruit.banana = 2;
        data.fruit.banana++;

        // 7 events: get fruit / set apple / get fruit / set banana / get fruit / get banana / set banana
        expect(counter).toBe(7);

        expect(source).toStrictEqual({ fruit: { apple: 1, banana: 3 } });
        expect(keys).toStrictEqual(['fruit', 'apple', 'fruit', 'banana', 'fruit', 'banana', 'banana']);
        expect(depths).toStrictEqual([0, 1, 0, 1, 0, 1, 1]);
        expect(values).toStrictEqual([
            undefined, // Fruit should be undefined at the start
            1, // Trying to assign 1 to apple
            { apple: 1 }, // Accessing fruit again
            2, // Assigning 2 to banana
            { apple: 1, banana: 2 }, // Accessing fruit again
            2, // getting the value 2
            3 // Setting the value to 3
        ]);

        expect(methods).toStrictEqual(['get', 'set', 'get', 'set', 'get', 'get', 'set']);
        expect(paths).toStrictEqual([
            ['fruit'],
            ['fruit', 'apple'],
            ['fruit'],
            ['fruit', 'banana'],
            ['fruit'],
            ['fruit', 'banana'],
            ['fruit', 'banana']
        ]);
    });

    test('Get of a missing key materializes an empty object on the target', () => {
        const source: any = {};
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        // Reading a key that does not exist still fires exactly one `get` payload
        void data.fruit;

        expect(payloads).toStrictEqual([
            {
                key: 'fruit',
                value: undefined,
                current: undefined,
                objectIsTarget: true,
                method: 'get',
                depth: 0,
                path: ['fruit']
            }
        ]);
        // The undefined value is replaced with `{}` on the raw target so deep chains can continue
        expect(source).toStrictEqual({ fruit: {} });
    });

    test('Get of an existing key reports the value and leaves the target untouched', () => {
        const source: any = { fruit: 'apple' };
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        expect(data.fruit).toBe('apple');

        // `current` is the pre-existing value for a defined key (unlike the undefined case)
        expect(payloads).toStrictEqual([
            {
                key: 'fruit',
                value: 'apple',
                current: 'apple',
                objectIsTarget: true,
                method: 'get',
                depth: 0,
                path: ['fruit']
            }
        ]);
        expect(source).toStrictEqual({ fruit: 'apple' });
    });

    test('Falsy values are returned as-is and are not replaced by the materialization fallback', () => {
        const source: any = { nul: null, zero: 0, empty: '', no: false };
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        const read = [data.nul, data.zero, data.empty, data.no];

        // Only `undefined` triggers the `{}` materialization; null/0/''/false pass through
        expect(read).toStrictEqual([null, 0, '', false]);
        expect(payloads).toStrictEqual([
            { key: 'nul', value: null, current: null, objectIsTarget: true, method: 'get', depth: 0, path: ['nul'] },
            { key: 'zero', value: 0, current: 0, objectIsTarget: true, method: 'get', depth: 0, path: ['zero'] },
            { key: 'empty', value: '', current: '', objectIsTarget: true, method: 'get', depth: 0, path: ['empty'] },
            { key: 'no', value: false, current: false, objectIsTarget: true, method: 'get', depth: 0, path: ['no'] }
        ]);
        expect(source).toStrictEqual({ nul: null, zero: 0, empty: '', no: false });
    });

    test('Nested objects are re-wrapped with an incremented depth and appended path', () => {
        const source: any = { a: { b: 1 } };
        const payloads: any[] = [];
        const raw: any[] = [];
        const data = objectObserve(source, (args) => {
            raw.push(args);
            payloads.push(snapshot(args, source));
        });

        const inner = data.a;
        // The nested value is a fresh observer wrapper, not the raw nested object
        expect(inner === source.a).toBe(false);
        expect(inner.b).toBe(1);

        expect(payloads).toStrictEqual([
            { key: 'a', value: { b: 1 }, current: { b: 1 }, objectIsTarget: true, method: 'get', depth: 0, path: ['a'] },
            { key: 'b', value: 1, current: 1, objectIsTarget: false, method: 'get', depth: 1, path: ['a', 'b'] }
        ]);
        // Each level reports the raw object that owns the key, never the proxy wrapper
        expect(raw[0].object).toBe(source);
        expect(raw[1].object).toBe(source.a);
    });

    test('A deep chained assignment records the full path chain', () => {
        const source: any = {};
        const payloads: any[] = [];
        const raw: any[] = [];
        const data = objectObserve(source, (args) => {
            raw.push(args);
            payloads.push(snapshot(args, source));
        });

        data.a.b.c = 1;

        // Exactly one event per hop: get a -> get b -> set c
        expect(payloads).toStrictEqual([
            { key: 'a', value: undefined, current: undefined, objectIsTarget: true, method: 'get', depth: 0, path: ['a'] },
            { key: 'b', value: undefined, current: undefined, objectIsTarget: false, method: 'get', depth: 1, path: ['a', 'b'] },
            { key: 'c', value: 1, current: undefined, objectIsTarget: false, method: 'set', depth: 2, path: ['a', 'b', 'c'] }
        ]);
        expect(source).toStrictEqual({ a: { b: { c: 1 } } });
        // The materialized intermediates are the raw objects the deep write walked through
        expect(raw[1].object).toBe(source.a);
        expect(raw[2].object).toBe(source.a.b);
    });

    test('The set trap always succeeds so strict-mode assignment never throws', () => {
        const source: any = { existing: 1 };
        const errors: string[] = [];
        const data = objectObserve(source, () => undefined);

        // A proxy `set` trap that returns false would throw a TypeError in strict mode
        try {
            data.existing = 2;
            data.fresh = 3;
            data.nested = { deep: 1 };
            data.nested.deep = 2;
        } catch (error: any) {
            errors.push(`${error.constructor.name}: ${error.message}`);
        }

        expect(errors).toStrictEqual([]);
        expect(source).toStrictEqual({ existing: 2, fresh: 3, nested: { deep: 2 } });
    });

    test('Assigning undefined still creates the key on the target', () => {
        const source: any = {};
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        data.cleared = undefined;

        expect(payloads).toStrictEqual([
            {
                key: 'cleared',
                value: undefined,
                current: undefined,
                objectIsTarget: true,
                method: 'set',
                depth: 0,
                path: ['cleared']
            }
        ]);
        // The key exists (own property) even though its value is undefined
        expect(Object.keys(source)).toStrictEqual(['cleared']);
        expect(source).toStrictEqual({ cleared: undefined });
    });

    test('An assigned object becomes observable one level deeper', () => {
        const source: any = {};
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        data.cfg = { retries: 3 };
        expect(data.cfg.retries).toBe(3);

        expect(payloads).toStrictEqual([
            {
                key: 'cfg',
                value: { retries: 3 },
                current: undefined,
                objectIsTarget: true,
                method: 'set',
                depth: 0,
                path: ['cfg']
            },
            {
                key: 'cfg',
                value: { retries: 3 },
                current: { retries: 3 },
                objectIsTarget: true,
                method: 'get',
                depth: 0,
                path: ['cfg']
            },
            {
                key: 'retries',
                value: 3,
                current: 3,
                objectIsTarget: false,
                method: 'get',
                depth: 1,
                path: ['cfg', 'retries']
            }
        ]);
        expect(source).toStrictEqual({ cfg: { retries: 3 } });
    });

    test('Reading an inherited key fires the callback and copies the value onto the target', () => {
        const source: any = {};
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        const constructor = data.constructor;

        // Inherited values are readable and are re-materialized as own properties
        expect(constructor).toBe(Object);
        expect(payloads).toStrictEqual([
            {
                key: 'constructor',
                value: Object,
                current: Object,
                objectIsTarget: true,
                method: 'get',
                depth: 0,
                path: ['constructor']
            }
        ]);
        expect(Object.keys(source)).toStrictEqual(['constructor']);
        expect(source.constructor).toBe(Object);
    });

    test('Symbol keys fire with the symbol itself and land as symbol-keyed properties', () => {
        const KEY = Symbol('token');
        const source: any = {};
        const payloads: any[] = [];
        // Symbols cannot be compared with toStrictEqual on the raw payload, so every key and
        // path segment is stringified at capture time while its runtime type is recorded too
        const capture = (args: any) =>
            payloads.push({
                key: String(args.key),
                keyType: typeof args.key,
                value: args.value,
                current: args.current,
                method: args.method,
                depth: args.depth,
                path: args.path.map((segment: unknown) => String(segment))
            });
        const data = objectObserve(source, capture);

        data[KEY] = 7;

        // The key is NOT coerced: the callback and the path both receive the raw symbol
        expect(payloads).toStrictEqual([
            {
                key: 'Symbol(token)',
                keyType: 'symbol',
                value: 7,
                current: undefined,
                method: 'set',
                depth: 0,
                path: ['Symbol(token)']
            }
        ]);
        // A real symbol-keyed property lands on the target; no string key is created
        expect(Object.keys(source)).toStrictEqual([]);
        expect(source[KEY]).toBe(7);
    });

    test('The explicit memory chain seeds depth and path', () => {
        const source: any = {};
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)), {
            depth: 5,
            path: ['root']
        });

        data.leaf = 1;

        // The internal recursion state is injectable: depth/path continue from the seed
        expect(payloads).toStrictEqual([
            {
                key: 'leaf',
                value: 1,
                current: undefined,
                objectIsTarget: true,
                method: 'set',
                depth: 5,
                path: ['root', 'leaf']
            }
        ]);
        expect(source).toStrictEqual({ leaf: 1 });
    });
});

describe('Object Observe wrapper identity', () => {
    // Intentional behaviour change (perf issue H4): one Proxy is memoized per raw object, so the
    // same raw object always resolves to the same wrapper inside a single observer.
    test('Nested wrappers are memoized per raw object', () => {
        const source: any = { a: { b: { c: 1 } }, prim: 'x' };
        const data = objectObserve(source, () => undefined);

        const a = data.a;
        const b = a.b;

        // Identity is stable across reads, at every hop
        expect(data.a === a).toBe(true);
        expect(a.b === b).toBe(true);
        expect(data.a.b === b).toBe(true);
        expect(a.b.c === 1).toBe(true);
        // A wrapper is still never the raw object it proxies
        expect(a === source.a).toBe(false);
        expect(b === source.a.b).toBe(false);
        // Primitives are handed back unwrapped
        expect(data.prim === 'x').toBe(true);
    });

    test('Two observers over the same data keep separate wrappers', () => {
        const source: any = { a: { b: 1 } };
        const first = objectObserve(source, () => undefined);
        const second = objectObserve(source, () => undefined);

        // The cache is per observer call, so wrappers never leak between observers
        expect(first.a === second.a).toBe(false);
        expect(first.a === first.a).toBe(true);
        expect(second.a === second.a).toBe(true);
        expect(first.a.b).toBe(1);
        expect(second.a.b).toBe(1);
    });

    test('A materialized key keeps the same wrapper across reads', () => {
        const source: any = {};
        const data = objectObserve(source, () => undefined);

        const created = data.missing;

        // Reading the missing key materialized `{}` on the raw target and wrapped it once
        expect(source).toStrictEqual({ missing: {} });
        expect(data.missing === created).toBe(true);
        // Writes through the cached wrapper still land on the raw target
        created.deeper = { deep: 1 };
        created.leaf = 2;
        expect(source).toStrictEqual({ missing: { deeper: { deep: 1 }, leaf: 2 } });
        expect(data.missing.deeper.deep).toBe(1);
    });

    test('Stable identity does not change the emitted event stream', () => {
        const source: any = { a: { b: 1 } };
        const payloads: any[] = [];
        const data = objectObserve(source, (args) => payloads.push(snapshot(args, source)));

        const first = data.a;
        const second = data.a;
        const value = second.b;

        expect(first === second).toBe(true);
        expect(value).toBe(1);
        // Two reads of the same key still fire two events, even though one wrapper is shared
        expect(payloads).toStrictEqual([
            { key: 'a', value: { b: 1 }, current: { b: 1 }, objectIsTarget: true, method: 'get', depth: 0, path: ['a'] },
            { key: 'a', value: { b: 1 }, current: { b: 1 }, objectIsTarget: true, method: 'get', depth: 0, path: ['a'] },
            { key: 'b', value: 1, current: 1, objectIsTarget: false, method: 'get', depth: 1, path: ['a', 'b'] }
        ]);
    });

    test('A six-level read reports the full path chain and stable wrappers at each hop', () => {
        const source: any = { l1: { l2: { l3: { l4: { l5: { l6: 'leaf' } } } } } };
        const events: string[] = [];
        const data = objectObserve(source, ({ key, depth, path }) => events.push(`${depth}:${path.join('.')}`));

        const first = data.l1;
        const second = first.l2;
        const leaf = first.l2.l3.l4.l5.l6;
        // Snapshot before the identity probes below, which add their own `get` events
        const walk = [...events];
        const sameFirst = data.l1 === first;
        const sameSecond = data.l1.l2 === second;
        const sameDeep = first.l2.l3.l4.l5 === first.l2.l3.l4.l5;

        expect(leaf).toBe('leaf');
        expect([sameFirst, sameSecond, sameDeep]).toStrictEqual([true, true, true]);
        expect(walk).toStrictEqual([
            '0:l1',
            '1:l1.l2',
            // The deep walk re-walks `l1.l2`, and the second hop is the same wrapper
            '1:l1.l2',
            '2:l1.l2.l3',
            '3:l1.l2.l3.l4',
            '4:l1.l2.l3.l4.l5',
            '5:l1.l2.l3.l4.l5.l6'
        ]);
        expect(source).toStrictEqual({ l1: { l2: { l3: { l4: { l5: { l6: 'leaf' } } } } } });
    });

    test('Deleting a nested key hands out a fresh wrapper for the materialized replacement', () => {
        const source: any = { a: { b: 1 } };
        const events: string[] = [];
        const data = objectObserve(source, ({ key, method, depth }) => events.push(`${method}:${key}@${depth}`));

        const first = data.a;
        const stable = data.a === first;
        // `objectProxy` has no deleteProperty trap: the delete lands on the raw target silently
        delete source.a;
        const next = data.a;

        expect(stable).toBe(true);
        expect(events).toStrictEqual(['get:a@0', 'get:a@0', 'get:a@0']);
        expect(source).toStrictEqual({ a: {} });
        // The cache is keyed by raw object, so the stale wrapper is not served for a new object
        expect(next === first).toBe(false);
        expect(data.a === next).toBe(true);
        // The old wrapper still points at the old (detached) raw object
        expect(first.b).toBe(1);
    });

    test('Replacing a nested object swaps the wrapper, replacing with a primitive drops it', () => {
        const source: any = { a: { b: 1 } };
        const data = objectObserve(source, () => undefined);

        const first = data.a;
        data.a = { b: 2 };
        const replacement = data.a;

        expect(replacement === first).toBe(false);
        expect(data.a === replacement).toBe(true);
        expect(data.a.b).toBe(2);
        expect(first.b).toBe(1);
        expect(source).toStrictEqual({ a: { b: 2 } });

        data.a = 'plain';
        expect(data.a).toBe('plain');
        expect(source).toStrictEqual({ a: 'plain' });
    });

    // Consequence of stable identity: one wrapper per raw object, so a wrapper reached through two
    // paths reports the path/depth of the most recent hand-off.
    test('An object reachable through two paths reports the most recent hand-off', () => {
        const shared: any = { k: 1 };
        const source: any = { x: shared, y: { deep: shared } };
        const events: string[] = [];
        const data = objectObserve(source, ({ key, depth, path }) => events.push(`${key}@${depth}:${path.join('.')}`));

        const sharedViaX = data.x;
        const firstKey = sharedViaX.k;
        const secondKey = data.y.deep.k;

        expect([firstKey, secondKey]).toStrictEqual([1, 1]);
        expect(events).toStrictEqual([
            'x@0:x',
            'k@1:x.k',
            'y@0:y',
            'deep@1:y.deep',
            // The shared wrapper is now stamped with the newest route
            'k@2:y.deep.k'
        ]);
        // Reading the `x` route again re-stamps the same wrapper back onto that path
        expect(data.x === sharedViaX).toBe(true);
        expect(data.x.k).toBe(1);
        expect(events.slice(-3)).toStrictEqual(['x@0:x', 'x@0:x', 'k@1:x.k']);
    });

    test('A held alias reports the path of the most recent hand-off to that wrapper', () => {
        const shared: any = { k: 1 };
        const source: any = { x: shared, y: { deep: shared } };
        const events: string[] = [];
        const data = objectObserve(source, ({ key, depth, path }) => events.push(`${key}@${depth}:${path.join('.')}`));

        const alias = data.x;
        const before = alias.k;
        data.y.deep;
        const after = alias.k;

        expect([before, after]).toStrictEqual([1, 1]);
        expect(events).toStrictEqual(['x@0:x', 'k@1:x.k', 'y@0:y', 'deep@1:y.deep', 'k@2:y.deep.k']);
    });

    test('Cyclic data resolves to the same wrapper without drifting the root context', () => {
        const source: any = { name: 'root' };
        source.self = source;
        const events: string[] = [];
        const data = objectObserve(source, ({ key, method, depth, path }) =>
            events.push(`${method}:${key}@${depth}:${path.join('.')}`)
        );

        const isRootWrapper = data.self === data;
        const deepName = data.self.self.name;
        data.fresh = 1;

        expect(isRootWrapper).toBe(true);
        expect(deepName).toBe('root');
        // Self hand-offs are not stamped, so root-level events keep depth 0 and the short path
        expect(events).toStrictEqual([
            'get:self@0:self',
            'get:self@0:self',
            'get:self@0:self',
            'get:name@0:name',
            'set:fresh@0:fresh'
        ]);
        expect(source).toStrictEqual({ name: 'root', self: source, fresh: 1 });
    });

    test('The seed memory chain is copied and seeds every nested level', () => {
        const source: any = { a: { b: 1 } };
        const seed = { depth: 3, path: ['root'] };
        const events: string[] = [];
        const data = objectObserve(source, ({ key, depth, path }) => events.push(`${key}@${depth}:${path.join('.')}`), seed);

        const inner = data.a;
        const value = inner.b;
        data.c = 3;

        expect(value).toBe(1);
        // The caller's chain object and its path array are never written by the observer
        expect(seed).toStrictEqual({ depth: 3, path: ['root'] });
        // Every nested level continues from the seeded prefix and depth
        expect(events).toStrictEqual(['a@3:root.a', 'b@4:root.a.b', 'c@3:root.c']);
        expect(source).toStrictEqual({ a: { b: 1 }, c: 3 });
    });
});

describe('Object Observe emitted payload isolation', () => {
    test('Retained params and paths keep their emitted values after later accesses', () => {
        const source: any = { a: { b: { c: 1 } } };
        const retained: any[] = [];
        const data = objectObserve(source, (args) => retained.push(args));

        const inner = data.a;
        const leaf = inner.b;
        const value = leaf.c;
        leaf.d = 2;
        const again = data.a;
        const fresh = data.x;

        expect(value).toBe(1);
        expect(again === inner).toBe(true);
        expect(fresh !== undefined).toBe(true);
        // Assertions run AFTER every access: nothing was rewritten under the retained payloads
        expect(retained.map((args) => args.key)).toStrictEqual(['a', 'b', 'c', 'd', 'a', 'x']);
        expect(retained.map((args) => args.method)).toStrictEqual(['get', 'get', 'get', 'set', 'get', 'get']);
        expect(retained.map((args) => args.depth)).toStrictEqual([0, 1, 2, 2, 0, 0]);
        expect(retained.map((args) => [...args.path])).toStrictEqual([
            ['a'],
            ['a', 'b'],
            ['a', 'b', 'c'],
            ['a', 'b', 'd'],
            ['a'],
            ['x']
        ]);
        expect(retained.map((args) => args.current)).toStrictEqual([source.a, source.a.b, 1, undefined, source.a, undefined]);
        // A missing key reports `value: undefined` even though the observer materializes `{}`
        expect(retained.map((args) => args.value)).toStrictEqual([source.a, source.a.b, 1, 2, source.a, undefined]);
        // Nothing is reused between events: every params object and every path array is unique
        expect(new Set(retained).size).toBe(6);
        expect(new Set(retained.map((args) => args.path)).size).toBe(6);
        expect(source).toStrictEqual({ a: { b: { c: 1, d: 2 } }, x: {} });
    });

    test('A callback that mutates its delivered path does not corrupt later events', () => {
        const source: any = { a: { b: 1 } };
        const paths: string[][] = [];
        const data = objectObserve(source, ({ path, method }) => {
            // `dataList` splices the array it receives (data/list.ts `path.splice(1)`)
            paths.push([...path]);
            if (method === 'set') path.splice(1);
        });

        data.a.b = 2;
        data.a.b = 3;

        expect(paths).toStrictEqual([['a'], ['a', 'b'], ['a'], ['a', 'b']]);
        expect(source).toStrictEqual({ a: { b: 3 } });
    });

    test('Appending to a get-event path also extends the nested prefix (documented aliasing)', () => {
        const source: any = { a: { b: 1 } };
        const events: string[] = [];
        const data = objectObserve(source, ({ key, path }) => {
            events.push(`${key}:${path.join('.')}`);
            // The wrapper adopts the delivered array as its own prefix, exactly as before the
            // optimization, where the payload path doubled as the nested observer chain path
            if (key === 'a') path.push('mutated');
        });

        const inner = data.a;
        const value = inner.b;

        expect(value).toBe(1);
        expect(events).toStrictEqual(['a:a', 'b:a.mutated.b']);
        expect(source).toStrictEqual({ a: { b: 1 } });
    });
});
