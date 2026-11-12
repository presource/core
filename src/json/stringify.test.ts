import { jsonStringify } from './stringify';

/**
 * Contract source: `src/json/stringify.ts`.
 *
 * `jsonStringify` is `JSON.stringify` plus an ancestor-stack replacer (stringify.ts:57-95).
 * The replacer pushes each object it enters and pops everything above the current parent, so a
 * value found in the stack is a TRUE cycle (omitted for objects, `null` for array elements) while
 * a value shared only between siblings serializes normally.
 */
describe('jsonStringify', () => {
    test('should stringify a simple object', () => {
        const obj = { a: 1, b: 'hello' };
        expect(jsonStringify(obj)).toBe(JSON.stringify(obj));
    });

    test('should stringify an array', () => {
        const arr = [1, 2, 3];
        expect(jsonStringify(arr)).toBe(JSON.stringify(arr));
    });

    test('should handle primitive values', () => {
        expect(jsonStringify('string')).toBe('"string"');
        expect(jsonStringify(123)).toBe('123');
        expect(jsonStringify(true)).toBe('true');
        expect(jsonStringify(null)).toBe('null');
    });

    test('should handle nested objects', () => {
        const obj = { a: { b: { c: 1 } } };
        expect(jsonStringify(obj)).toBe(JSON.stringify(obj));
    });

    // --- Replacer pass-through semantics (stringify.ts:59-61) ---
    // The replacer returns primitives untouched, so native JSON rules apply verbatim.

    test('should stringify non-finite numbers and -0 like native JSON', () => {
        expect(jsonStringify(NaN)).toBe('null');
        expect(jsonStringify(Infinity)).toBe('null');
        expect(jsonStringify(-Infinity)).toBe('null');
        expect(jsonStringify(-0)).toBe('0');
    });

    // `JSON.stringify(undefined)` returns the value `undefined`, not the string "undefined".
    test('should return undefined (not a string) for undefined input', () => {
        expect(jsonStringify(undefined)).toBeUndefined();
    });

    test('should return undefined for top-level symbol and function inputs', () => {
        expect(jsonStringify(Symbol('s'))).toBeUndefined();
        expect(jsonStringify(function named() {})).toBeUndefined();
        // Arrow functions have no own enumerable properties either.
        expect(jsonStringify(() => 1)).toBeUndefined();
    });

    // Object keys whose values are undefined / functions are dropped; array slots become null.
    test('should omit undefined and function valued object keys but null out array holes', () => {
        expect(jsonStringify({ a: undefined, b: function () {}, c: null })).toBe('{"c":null}');
        expect(jsonStringify([1, undefined, 2])).toBe('[1,null,2]');
        expect(jsonStringify([, 1, , 2])).toBe('[null,1,null,2]');
    });

    test('should stringify empty containers and falsy scalars exactly', () => {
        expect(jsonStringify({ e: {}, arr: [], s: '', n: 0, f: false })).toBe(
            '{"e":{},"arr":[],"s":"","n":0,"f":false}',
        );
        expect(jsonStringify([{}, [], [[]]])).toBe('[{},[],[[]]]');
    });

    test('should escape quotes and newlines in string values', () => {
        expect(jsonStringify('a"b\nc')).toBe('"a\\"b\\nc"');
        expect(jsonStringify({ k: 'a\ud83d\ude00b' })).toBe('{"k":"a\ud83d\ude00b"}');
    });

    // --- Built-in object forms that are not plain objects/arrays ---

    test('should stringify a Date through its toJSON as an ISO string', () => {
        expect(jsonStringify({ d: new Date('2020-01-02T03:04:05.000Z') })).toBe(
            '{"d":"2020-01-02T03:04:05.000Z"}',
        );
        expect(jsonStringify(new Date('2020-01-02T03:04:05.000Z'))).toBe('"2020-01-02T03:04:05.000Z"');
    });

    // RegExp / Map / Set have no own enumerable properties, so native JSON renders `{}`.
    test('should stringify RegExp, Map and Set as empty objects', () => {
        expect(jsonStringify(/ab+c/gi)).toBe('{}');
        expect(jsonStringify(new Map([['a', 1]]))).toBe('{}');
        expect(jsonStringify(new Set([1, 2]))).toBe('{}');
        expect(jsonStringify({ m: new Map([['k', { a: 1 }]]), s: new Set([1]) })).toBe('{"m":{},"s":{}}');
    });

    test('should stringify class instances and prototype-less objects by own enumerable keys', () => {
        class Widget {
            x = 1;
        }
        expect(jsonStringify(new Widget())).toBe('{"x":1}');

        const nullProto = Object.create(null);
        nullProto.a = 1;
        expect(jsonStringify({ o: nullProto })).toBe('{"o":{"a":1}}');
    });

    test('should honour a custom toJSON on nested values', () => {
        expect(jsonStringify({ t: { toJSON: () => 'replaced' } })).toBe('{"t":"replaced"}');
    });

    test('should unwrap a boxed boolean primitive like native JSON', () => {
        expect(jsonStringify(new Boolean(true))).toBe('true');
    });

    // BigInt has no JSON representation at all: the native serializer still throws.
    test('should throw TypeError when serializing a BigInt', () => {
        expect(() => jsonStringify(10n)).toThrow(TypeError);
        expect(() => jsonStringify({ b: 10n })).toThrow('Do not know how to serialize a BigInt');
    });

    // --- Circular reference handling ---
    // Native JSON.stringify throws TypeError on circular structures.
    // jsonStringify should omit circular descendant keys instead.

    test('should omit direct self-reference (circular) instead of throwing', () => {
        // obj.a -> obj (direct cycle)
        const obj: Record<string, any> = { x: 1 };
        obj.self = obj;

        const result = jsonStringify(obj);
        // 'self' key omitted because it would create a circular reference
        expect(result).toBe('{"x":1}');
    });

    // Key order is insertion order, so the cycle being first does not shift the survivor keys.
    test('should omit a self-reference declared before other keys', () => {
        const obj: Record<string, any> = { self: null, a: 1 };
        obj.self = obj;
        expect(jsonStringify(obj)).toBe('{"a":1}');
    });

    test('should omit deeper circular references', () => {
        // inner.parent -> obj, obj.b -> inner (two-step cycle)
        const inner: Record<string, any> = { c: 3 };
        const obj: Record<string, any> = { a: 1, b: inner };
        inner.parent = obj;
        inner.self = inner; // inner also points to itself

        const result = jsonStringify(obj);
        // Exact output: both cycle-closing keys are dropped.
        expect(result).toBe('{"a":1,"b":{"c":3}}');
        expect(() => JSON.parse(result)).not.toThrow();
        const parsed = JSON.parse(result);
        // Non-circular values survive
        expect(parsed.a).toBe(1);
        expect(parsed.b.c).toBe(3);
        // Circular keys are omitted
        expect(parsed.b.parent).toBeUndefined();
        expect(parsed.b.self).toBeUndefined();
    });

    // Three-node cycle (b -> a -> c -> b) reached from b: only the cycle-closing key disappears.
    test('should break a three-node cycle at the closing key', () => {
        const a: Record<string, any> = {};
        const b: Record<string, any> = { a };
        const cc: Record<string, any> = { b };
        a.c = cc;

        expect(jsonStringify(b)).toBe('{"a":{"c":{}}}');
    });

    // A 4-level chain with a back-pointer to the root: the deepest key is the one dropped.
    test('should omit a back-pointer four levels deep', () => {
        const l4: Record<string, any> = { n: 4 };
        const l3 = { l4 };
        const l2 = { l3 };
        const l1: Record<string, any> = { l2 };
        l4.back = l1;

        expect(jsonStringify(l1)).toBe('{"l2":{"l3":{"l4":{"n":4}}}}');
    });

    test('should handle sibling objects sharing a common ancestor reference', () => {
        // shared is referenced by both a and b, but neither creates a cycle
        const shared = { value: 42 };
        const obj = { a: shared, b: shared };

        // Native handles this fine (duplicate references produce duplicate JSON)
        expect(jsonStringify(obj)).toBe(JSON.stringify(obj));
        expect(jsonStringify(obj)).toBe('{"a":{"value":42},"b":{"value":42}}');
    });

    // The stack pop step (stringify.ts:75-77) is what makes sibling reuse safe: an object that
    // was a descendant on one branch is still serializable on the next branch.
    test('should serialize the same object at different depths without a cycle', () => {
        const leaf = { l: 1 };

        expect(jsonStringify({ shallow: leaf, deep: { mid: { leaf } } })).toBe(
            '{"shallow":{"l":1},"deep":{"mid":{"leaf":{"l":1}}}}',
        );
        expect(jsonStringify({ deep: { mid: { leaf } }, shallow: leaf })).toBe(
            '{"deep":{"mid":{"leaf":{"l":1}}},"shallow":{"l":1}}',
        );

        const shared = { z: 1 };
        const p = { z: shared };
        const q = { z: shared, p };
        expect(jsonStringify({ q, p })).toBe(
            '{"q":{"z":{"z":1},"p":{"z":{"z":1}}},"p":{"z":{"z":1}}}',
        );
    });

    // `o` is a value of `x`, not an ancestor of it, so this is not a cycle even though `o` repeats.
    test('should serialize a node that is referenced by two unrelated ancestors', () => {
        const o = { a: 1 };
        const obj = { x: { o }, y: o, z: 3 };

        expect(jsonStringify(obj)).toBe('{"x":{"o":{"a":1}},"y":{"a":1},"z":3}');
        expect(jsonStringify(obj)).toBe(JSON.stringify(obj));
    });

    test('should handle circular arrays by converting circular element to null', () => {
        // arr pushes itself as the last element (self-referencing array)
        const arr: any[] = [1, 2, 3];
        arr.push(arr);

        const result = jsonStringify(arr);
        // Exact output: the cycle-closing slot becomes null, length is preserved.
        expect(result).toBe('[1,2,3,null]');
        expect(() => JSON.parse(result)).not.toThrow();
        const parsed = JSON.parse(result);
        // First three elements survive unchanged
        expect(parsed[0]).toBe(1);
        expect(parsed[1]).toBe(2);
        expect(parsed[2]).toBe(3);
        // Fourth element (circular) becomes null because JSON.stringify
        // converts undefined array elements to null — there is no way to
        // "remove" an array element the way object keys can be omitted.
        expect(parsed[3]).toBeNull();
        expect(parsed.length).toBe(4);
    });

    // Object -> array -> object cycle: the array slot is null, the object key would be omitted.
    test('should null out an array slot that closes a cycle through an object', () => {
        const obj: Record<string, any> = { list: [] };
        obj.list.push(obj);

        expect(jsonStringify(obj)).toBe('{"list":[null]}');

        const record: any[] = [1];
        const outer: any[] = [record, 2];
        record.push(outer);
        expect(jsonStringify(outer)).toBe('[[1,null],2]');
    });

    // When the cycle source is a self-referencing array, the array rule (null) wins for BOTH
    // sibling keys because the array itself is the repeated ancestor.
    test('should null the circular slot in every sibling that reuses a cyclic array', () => {
        const arr: any[] = [1];
        arr.push(arr);
        const obj = { a: arr, b: arr };

        expect(jsonStringify(obj)).toBe('{"a":[1,null],"b":[1,null]}');
    });

    test('should not mutate the original object with circular references', () => {
        // Verify that passing a circular object through jsonStringify
        // does not remove or modify any properties on the original.
        const obj: Record<string, any> = { a: 1 };
        obj.b = obj;

        const beforeKeys = Object.keys(obj);
        jsonStringify(obj);
        const afterKeys = Object.keys(obj);

        expect(afterKeys).toEqual(beforeKeys);
        expect(afterKeys).toStrictEqual(['a', 'b']);
        // The circular reference still exists on the original
        expect(obj.b).toBe(obj);
    });

    // Idempotence proves the ancestor stack is per-call state, not module level state.
    test('should return byte-identical output on repeated calls and leave plain input untouched', () => {
        const obj = { a: 1, list: [1, 2, { b: undefined }] };
        const first = jsonStringify(obj);
        const second = jsonStringify(obj);

        expect(first).toBe('{"a":1,"list":[1,2,{}]}');
        expect(second).toBe(first);
        expect(Object.keys(obj)).toStrictEqual(['a', 'list']);
        expect(obj.list[2].b).toBeUndefined();
    });

    // --- Ancestor-path identity mirror (stringify.ts `onPath` Set) ---
    //
    // The cycle check is a linear `ancestors.includes` scan below `DEEP_PATH_SIZE` (256) and
    // an O(1) `Set.has` above it. Both must agree: a stale mirror entry turns a legitimate
    // re-use into a false cycle (the key silently disappears), a missing one emits a cycle.
    // The shallow tests below cover the scan branch, the deep ones the Set branch.

    // 40 sibling branches that each re-open the SAME leaf at a different depth: every branch
    // is fully popped before the next one starts, so nothing may be treated as an ancestor.
    test('should not report a false cycle when deep sibling branches reuse one object', () => {
        const shared = { s: 1 };
        const obj: Record<string, any> = {};

        for (let branch = 0; branch < 40; branch++) {
            let node: any = { shared };
            for (let depth = 0; depth < branch; depth++) node = { child: node };
            obj['b' + branch] = node;
        }

        // Acyclic input, so the output must be byte-identical to the native serializer.
        expect(jsonStringify(obj)).toBe(JSON.stringify(obj));
    });

    // Mirror completeness the other way round: the cycle target is 40 levels above the
    // closing key, so the whole path has to stay addressable, not just its tail.
    test('should still detect a cycle whose target is 40 levels up the path', () => {
        const nodes: Record<string, any>[] = [];
        for (let i = 0; i < 40; i++) nodes.push({ n: i });
        for (let i = 1; i < nodes.length; i++) nodes[i - 1].child = nodes[i];
        // Independent expectation: native stringify with the cycle-closing key removed.
        const expected = JSON.stringify(nodes[0], (_key, value) =>
            _key === 'back' && value === nodes[0] ? undefined : value,
        );

        nodes[nodes.length - 1].back = nodes[0];

        const result = jsonStringify(nodes[0]);
        expect(result).toBe(expected);
        expect(JSON.parse(result)).not.toHaveProperty('back');
    });

    // Past DEEP_PATH_SIZE the mirror is materialised mid-descent, so the pop loop that walks
    // back out of a deep branch must drain it too: 20 branches of 280 levels each re-open the
    // same `shared` leaf, and none of those re-uses may be dropped.
    test('should not report a false cycle once the deep-path Set has been built', () => {
        const shared = { s: 1 };
        const obj: Record<string, any> = {};

        for (let branch = 0; branch < 20; branch++) {
            let node: any = { shared, b: branch };
            for (let depth = 0; depth < 280; depth++) node = { child: node };
            obj['b' + branch] = node;
        }

        expect(jsonStringify(obj)).toBe(JSON.stringify(obj));
    });

    // Same depth, cycle side: a back-pointer 300 levels down is only caught if the lazily
    // seeded Set already holds the root (it is created at level 256, from the current path).
    test('should detect a cycle whose target is 300 levels up the path', () => {
        const nodes: Record<string, any>[] = [];
        for (let i = 0; i < 300; i++) nodes.push({ n: i });
        for (let i = 1; i < nodes.length; i++) nodes[i - 1].child = nodes[i];
        const expected = JSON.stringify(nodes[0], (_key, value) =>
            _key === 'back' && value === nodes[0] ? undefined : value,
        );

        nodes[nodes.length - 1].back = nodes[0];

        expect(jsonStringify(nodes[0])).toBe(expected);
    });
});
