import { objectAlias } from '@presource/core';

describe('Object Alias Test', () => {
    test('Object aliasing', () => {
        const data = {
            index: 1,
            count: 2,
            length: 3
        };

        // Creating an alias object with the follow abreviations
        const alias = objectAlias(data, {
            i: 'index',
            c: 'count',
            l: 'length'
        });

        const checkMatching = () => {
            expect(alias.i).toBe(alias.index);
            expect(alias.c).toBe(alias.count);
            expect(alias.l).toBe(alias.length);
        };

        // First Check
        checkMatching();

        data.count++;
        checkMatching();

        alias.index++;
        checkMatching();

        alias.l = 10;
        checkMatching();

        // Expecting the Final Result to be
        expect(data).toStrictEqual({
            index: 2,
            count: 3,
            length: 10
        });

        // JSON of data and alias should match
        expect(JSON.stringify(data)).toStrictEqual(JSON.stringify(alias));
    });

    // ----------------------------------------------------------------------------------------
    // Edge cases. Contract source: src/object/alias.ts:35-57 - the alias map is snapshotted into
    // a prototype-less copy once per call and `getActualKey = aliasMap[key] || key` (alias.ts:48),
    // on top of src/object/proxy.ts get/set traps. Verified against the built runtime (Temp probes).
    // ----------------------------------------------------------------------------------------

    test('alias reads forward to the real key and stay live', () => {
        const data = { index: 1, count: 2 };
        const alias = objectAlias<{ index: number; count: number }, { i: 'index'; c: 'count' }>(data, {
            i: 'index',
            c: 'count'
        });

        // Alias reads resolve through the map to the underlying value
        expect(alias.i).toBe(1);
        expect(alias.c).toBe(2);

        // The proxy holds the original reference, so raw mutation is visible through the alias
        data.index = 42;
        expect(alias.i).toBe(42);
    });

    test('alias writes land on the real key and never create the alias key', () => {
        const data = { index: 1 };
        const alias = objectAlias(data, { i: 'index' });

        alias.i = 7;

        // The write is forwarded to `index`; `i` is not added to the underlying object
        expect(data).toStrictEqual({ index: 7 });
        expect(Object.prototype.hasOwnProperty.call(data, 'i')).toBe(false);
        expect(Object.keys(data)).toStrictEqual(['index']);
        expect(alias.i).toBe(7);
    });

    test('non-aliased keys fall through to the original key on read and write', () => {
        const data = { real: 'value' } as Record<string, unknown>;
        const alias = objectAlias(data, { r: 'real' });

        // Unmapped read: `alias['real']` is undefined, so the key itself is used
        expect(alias.real).toBe('value');
        expect(alias.notMapped).toBeUndefined();

        // Unmapped write: stored under the accessed key, not under an alias target
        alias.notMapped = 'added';
        expect(data).toStrictEqual({ real: 'value', notMapped: 'added' });
        expect(alias.notMapped).toBe('added');
    });

    test('alias whose target is an empty string resolves back to the accessed key', () => {
        // alias.ts:48 uses `||`, so the falsy '' target is discarded and `key` is returned
        const data = { existing: 'kept' };
        const alias = objectAlias(data, { existing: '' });
        expect(alias.existing).toBe('kept');

        alias.existing = 'overwritten';
        expect(data).toStrictEqual({ existing: 'overwritten' });

        // A brand new key with a '' target is created under the alias key itself
        const blank = {} as Record<string, unknown>;
        const blankAlias = objectAlias(blank, { fresh: '' });
        blankAlias.fresh = 5;
        expect(blank).toStrictEqual({ fresh: 5 });
    });

    test('alias key that shadows a real key always resolves through the map', () => {
        const data = { a: 1, b: 2 };
        const alias = objectAlias(data, { a: 'b' });

        // The alias entry wins over the real `a` key
        expect(alias.a).toBe(2);

        alias.a = 99;

        // Both the read path and the write path target `b`; `a` keeps its original value
        expect(data).toStrictEqual({ a: 1, b: 99 });
        // Serialisation goes through the same trap, so `a` reports the shadowed value
        expect(JSON.stringify(alias)).toBe('{"a":99,"b":99}');
    });

    test('inherited alias-map entries no longer hijack unmapped key lookups', () => {
        // The map is snapshotted into a prototype-less copy (own enumerable keys only), so an
        // inherited entry such as `Object.prototype.toString` can no longer become the "real key".
        // While the map was read live (`alias[key]`), the chain walk made this lookup miss.
        const data = { toString: 'own value', a: 1 };
        const alias = objectAlias(data, {});

        expect(alias.a).toBe(1);
        expect(alias.toString).toBe('own value');

        // A constructor-named key resolves to the data entry the same way
        expect(objectAlias({ constructor: 'own value' }, {}).constructor).toBe('own value');
    });

    test('the alias map is snapshotted when the proxy is created', () => {
        // The get/set traps read the per-call copy, so later edits to the map object are not
        // observed by an existing proxy (the underlying `data` object still stays live).
        const data = { real: 'value' } as Record<string, unknown>;
        const map: Record<string, string> = { r: 'real' };
        const alias = objectAlias(data, map);

        expect(alias.r).toBe('value');

        // A newly added map entry is invisible to the already-created proxy
        map.later = 'real';
        expect(alias.later).toBeUndefined();
        expect(data.later).toBeUndefined();

        // And a removed entry keeps resolving through the snapshot
        delete map.r;
        expect(alias.r).toBe('value');
    });

    test('proxy is a new reference exposing only the original keys', () => {
        const data = { a: 1, b: 2 };
        const alias = objectAlias(data, { x: 'a', y: 'b' });

        expect(alias === data).toBe(false);
        // ownKeys/has traps are not overridden, so only the target keys are visible
        expect(Object.keys(alias)).toStrictEqual(['a', 'b']);
        expect('x' in alias).toBe(false);
        expect('a' in alias).toBe(true);
        expect(JSON.stringify(alias)).toBe('{"a":1,"b":2}');
        expect({ ...alias }).toStrictEqual({ a: 1, b: 2 });
    });

    test('delete is not trapped and removes the key from the underlying object', () => {
        const data = { a: 1, b: 2 };
        const alias = objectAlias(data, { x: 'a' });

        delete alias.a;

        expect(data).toStrictEqual({ b: 2 });
        expect(alias.x).toBeUndefined();
    });

    test('nested values and functions are shared by reference', () => {
        const nested = { deep: true } as { deep: boolean; added?: number };
        const fn = () => 'called';
        const alias = objectAlias({ nested, fn }, { n: 'nested', f: 'fn' });

        expect(alias.n).toBe(nested);
        expect(alias.f).toBe(fn);
        expect(alias.f()).toBe('called');

        // Writes mutate the shared nested object, they are not cloned
        alias.n.added = 1;
        expect(nested).toStrictEqual({ deep: true, added: 1 });
    });

    test('writing through an alias creates the target key when it is missing', () => {
        const data = {} as Record<string, unknown>;
        const alias = objectAlias(data, { x: 'alpha' });

        alias.x = 5;

        expect(data).toStrictEqual({ alpha: 5 });
        expect(alias.x).toBe(5);
    });

    test('symbol keys bypass the alias map', () => {
        const data = {} as Record<string | symbol, unknown>;
        const alias = objectAlias(data, { y: 'k' });
        const symbol = Symbol('s');

        // `alias[symbol]` is undefined, so the symbol itself becomes the real key
        (alias as any)[symbol] = 'symbol value';

        expect(data[symbol]).toBe('symbol value');
        expect((alias as any)[symbol]).toBe('symbol value');
        expect(Object.keys(data)).toStrictEqual([]);
    });

    test('non-object data target throws', () => {
        // objectProxy builds a real Proxy, which rejects a null target
        expect(() => objectAlias(null as any, {})).toThrow(TypeError);
        expect(() => objectAlias(null as any, {})).toThrow('Cannot create proxy with a non-object as target or handler');
    });

    test('a null alias map throws at construction', () => {
        // alias.ts snapshots with `Object.keys(alias)`, so an invalid map now fails eagerly at
        // construction. HEAD only failed later: the traps read `alias[key]` live, so the same
        // TypeError surfaced on the first proxied get/set instead.
        expect(() => objectAlias({ a: 1 }, null as any)).toThrow(TypeError);
        expect(() => objectAlias({ a: 1 }, null as any)).toThrow('Cannot convert undefined or null to object');
    });

    test('an undefined alias map throws at construction', () => {
        // Same eager-snapshot failure as the `null` map above (alias.ts `Object.keys(alias)`).
        expect(() => objectAlias({ a: 1 }, undefined as any)).toThrow(TypeError);
        expect(() => objectAlias({ a: 1 }, undefined as any)).toThrow('Cannot convert undefined or null to object');
    });
});
