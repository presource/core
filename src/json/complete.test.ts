import { jsonComplete } from '@presource/core';

/**
 * Contract source: `src/json/complete.ts`.
 *
 * `jsonComplete` has three exits (all pinned below):
 *  1. Fast path — `JSON.parse` succeeds on the raw input (complete.ts:33-37).
 *  2. Empty-string guard — `''` returns `undefined` BEFORE any repair attempt (complete.ts:40-42).
 *  3. Repair pass — character scan (complete.ts:61-137) + append rules (complete.ts:141-162),
 *     then a second `JSON.parse`. Success returns the value (complete.ts:166); failure lands in
 *     the final `catch { return undefined }` at complete.ts:167-169 — the branch exercised by the
 *     "unrecoverable" block at the bottom of this file.
 */
describe('jsonComplete', () => {
    // --- Already complete JSON (passthrough) ---

    test('should return parsed object when JSON is already complete', () => {
        expect(jsonComplete('{"chapters":"test"}')).toStrictEqual({ chapters: 'test' });
    });

    test('should return parsed array when JSON is already complete', () => {
        expect(jsonComplete('[1,2,3]')).toStrictEqual([1, 2, 3]);
    });

    // Passthrough of every JSON primitive form (fast path, complete.ts:34).
    test('should pass through top-level primitives when already valid', () => {
        expect(jsonComplete('null')).toBeNull();
        expect(jsonComplete('true')).toBe(true);
        expect(jsonComplete('false')).toBe(false);
        expect(jsonComplete('123')).toBe(123);
        expect(jsonComplete('"x"')).toBe('x');
    });

    // Whitespace-only padding is legal JSON, so the fast path still wins.
    test('should pass through whitespace padded valid JSON', () => {
        expect(jsonComplete('{  }  ')).toStrictEqual({});
        expect(jsonComplete(' [ ] ')).toStrictEqual([]);
    });

    test('should return nested structures unchanged when already complete', () => {
        expect(jsonComplete('{"a":[1,{"b":2}],"c":{"d":[true,null]}}')).toStrictEqual({
            a: [1, { b: 2 }],
            c: { d: [true, null] },
        });
    });

    // --- Missing closing brace on object ---

    test('should close missing object brace with string value', () => {
        expect(jsonComplete('{"chapters":"test"')).toStrictEqual({ chapters: 'test' });
    });

    test('should close missing object brace with number value', () => {
        expect(jsonComplete('{"count":42')).toStrictEqual({ count: 42 });
    });

    test('should close missing object brace with boolean value', () => {
        expect(jsonComplete('{"active":true')).toStrictEqual({ active: true });
    });

    test('should close missing object brace with null value', () => {
        expect(jsonComplete('{"data":null')).toStrictEqual({ data: null });
    });

    // --- Missing closing quote and brace (original test) ---

    test('should close both missing string quote and object brace', () => {
        expect(jsonComplete('{"chapters":"test')).toStrictEqual({ chapters: 'test' });
    });

    // --- Missing closing bracket on array ---

    test('should close missing array bracket', () => {
        expect(jsonComplete('[1,2,3')).toStrictEqual([1, 2, 3]);
    });

    test('should close missing array bracket with string elements', () => {
        expect(jsonComplete('["a","b","c"')).toStrictEqual(['a', 'b', 'c']);
    });

    // --- Empty incomplete structures ---

    test('should close empty incomplete object', () => {
        expect(jsonComplete('{')).toStrictEqual({});
    });

    test('should close empty incomplete array', () => {
        expect(jsonComplete('[')).toStrictEqual([]);
    });

    // Leading/trailing whitespace survives the repair pass because the appended
    // characters still produce parseable JSON.
    test('should complete whitespace padded fragments', () => {
        expect(jsonComplete(' {"a":1')).toStrictEqual({ a: 1 });
        expect(jsonComplete('{"a":1} ')).toStrictEqual({ a: 1 });
        expect(jsonComplete('[1,2] ')).toStrictEqual([1, 2]);
    });

    // --- Nested incomplete objects ---

    test('should close nested objects missing both closures', () => {
        expect(jsonComplete('{"a":{"b":"c"')).toStrictEqual({ a: { b: 'c' } });
    });

    test('should close triple-nested object missing all closures', () => {
        expect(jsonComplete('{"a":{"b":{"c":"d"')).toStrictEqual({ a: { b: { c: 'd' } } });
    });

    // Four levels: proves rule 4 keeps popping the stack until it is empty.
    test('should close four levels of nested objects innermost-first', () => {
        expect(jsonComplete('{"a":{"b":{"c":{"d":1')).toStrictEqual({ a: { b: { c: { d: 1 } } } });
    });

    // --- Nested incomplete arrays ---

    test('should close nested array missing bracket', () => {
        expect(jsonComplete('{"items":[1,2')).toStrictEqual({ items: [1, 2] });
    });

    test('should close array of objects with missing bracket', () => {
        expect(jsonComplete('[{"a":1},{"b":2')).toStrictEqual([{ a: 1 }, { b: 2 }]);
    });

    // --- Mixed nesting ---

    test('should close object containing incomplete nested array', () => {
        expect(jsonComplete('{"data":[1,2,3')).toStrictEqual({ data: [1, 2, 3] });
    });

    test('should close incomplete object inside array', () => {
        expect(jsonComplete('[{"key":"val"')).toStrictEqual([{ key: 'val' }]);
    });

    // Enclosure order matters: the `{` opened inside `[` must close before the `[`.
    test('should close mixed enclosures innermost-first', () => {
        expect(jsonComplete('{"a":[1,2')).toStrictEqual({ a: [1, 2] });
        expect(jsonComplete('[1,[2,[3')).toStrictEqual([1, [2, [3]]]);
        expect(jsonComplete('[{"a":{"b":[1,')).toStrictEqual([{ a: { b: [1] } }]);
        expect(jsonComplete('{"a":[{"b":[1,2')).toStrictEqual({ a: [{ b: [1, 2] }] });
    });

    // --- Trailing comma handling ---

    test('should remove trailing comma in object and close', () => {
        expect(jsonComplete('{"a":1,')).toStrictEqual({ a: 1 });
    });

    test('should remove trailing comma in array and close', () => {
        expect(jsonComplete('[1,2,')).toStrictEqual([1, 2]);
    });

    test('should remove trailing comma after nested object', () => {
        expect(jsonComplete('{"a":{"b":1},')).toStrictEqual({ a: { b: 1 } });
    });

    test('should remove trailing comma after nested array', () => {
        expect(jsonComplete('{"a":[1,2],')).toStrictEqual({ a: [1, 2] });
    });

    // Rule 3 is `completed.endsWith(',')`, so a space after the comma is NOT stripped.
    // The repair output stays invalid and the final catch (complete.ts:168) returns undefined.
    test('should return undefined when the trailing comma is followed by whitespace', () => {
        expect(jsonComplete('{"a":1, ')).toBeUndefined();
        expect(jsonComplete('[1,2, ')).toBeUndefined();
    });

    // --- Escaped characters in strings ---

    test('should handle escaped quote inside string value', () => {
        expect(jsonComplete('{"key":"val\\"ue"')).toStrictEqual({ key: 'val"ue' });
    });

    test('should complete string with escaped quote not yet closed', () => {
        expect(jsonComplete('{"key":"val\\"ue')).toStrictEqual({ key: 'val"ue' });
    });

    // `\\` escapes the backslash itself, so the following `"` really closes the string.
    test('should treat an escaped backslash as leaving the string closed', () => {
        expect(jsonComplete('{"a":"\\\\"')).toStrictEqual({ a: '\\' });
    });

    // `\n` inside the raw text is a two-character escape sequence that JSON.parse resolves.
    test('should keep escape sequences inside an unterminated string', () => {
        expect(jsonComplete('{"a":"x\\n y')).toStrictEqual({ a: 'x\n y' });
    });

    // A backslash-escaped quote inside a KEY swallows the rest of the input; unrepairable.
    test('should return undefined for an escaped quote inside an object key', () => {
        expect(jsonComplete('{"a\\":1')).toBeUndefined();
    });

    // --- Multiple key-value pairs ---

    test('should close object with multiple key-value pairs', () => {
        expect(jsonComplete('{"a":1,"b":2,"c":3')).toStrictEqual({ a: 1, b: 2, c: 3 });
    });

    // --- Deeply nested mixed structures ---

    test('should close complex nested structure', () => {
        expect(jsonComplete('{"users":[{"name":"Alice","scores":[90,85')).toStrictEqual({
            users: [{ name: 'Alice', scores: [90, 85] }],
        });
    });

    // --- String key without value (rule 2, complete.ts:149-151) ---

    test('should handle string key missing value and closure', () => {
        expect(jsonComplete('{"name"')).toStrictEqual({ name: '' });
    });

    test('should append empty string value for a bare trailing key', () => {
        expect(jsonComplete('{"a":1,"b"')).toStrictEqual({ a: 1, b: '' });
        expect(jsonComplete('{"a":"b","c"')).toStrictEqual({ a: 'b', c: '' });
        expect(jsonComplete('{"a":{"b":1},"c"')).toStrictEqual({ a: { b: 1 }, c: '' });
    });

    // Bare key nested one level deeper: `nextStringIsValue` is reset by `{`, so the inner
    // string is still treated as a key.
    test('should append empty string value for a bare key inside a nested object', () => {
        expect(jsonComplete('{"a":{"b"')).toStrictEqual({ a: { b: '' } });
        expect(jsonComplete('{"a":[{"b"')).toStrictEqual({ a: [{ b: '' }] });
    });

    // `nextStringIsValue` branches: a string after `:` or inside `[` is a VALUE, so rule 2
    // must not append `:""` for it.
    test('should not append a value for strings already in value position', () => {
        expect(jsonComplete('{"a":"b"')).toStrictEqual({ a: 'b' });
        expect(jsonComplete('[{"a":1},"b"')).toStrictEqual([{ a: 1 }, 'b']);
    });

    // --- Nested string closure ---

    test('should close inner string and outer object', () => {
        expect(jsonComplete('{"outer":{"inner":"text')).toStrictEqual({
            outer: { inner: 'text' },
        });
    });

    // --- Array with nested incomplete object ---

    test('should close array containing incomplete nested object', () => {
        expect(jsonComplete('[{"id":1},{"id":2')).toStrictEqual([{ id: 1 }, { id: 2 }]);
    });

    // --- Unicode / emoji inside strings ---

    test('should complete fragments containing emoji', () => {
        expect(jsonComplete('"a\ud83d\ude00b"')).toBe('a\ud83d\ude00b');
        expect(jsonComplete('{"k":"a\ud83d\ude00')).toStrictEqual({ k: 'a\ud83d\ude00' });
        expect(jsonComplete('["a\ud83d\ude00b"')).toStrictEqual(['a\ud83d\ude00b']);
    });

    // --- Empty / degenerate structures that still repair ---

    test('should complete objects and arrays whose openers are only commas', () => {
        expect(jsonComplete('{,')).toStrictEqual({});
        expect(jsonComplete('[,')).toStrictEqual([]);
    });

    // --- Already valid but edge-case strings ---

    test('should handle empty string input as-is (passthrough)', () => {
        // Empty string is not valid JSON; this tests graceful failure or empty result
        // The function should either return undefined or throw — we define it returns undefined
        expect(jsonComplete('')).toBeUndefined();
    });

    // `''` is special-cased by the length guard (complete.ts:40). A whitespace-only string is
    // length 1, so it reaches the repair pass and dies in the final catch instead (complete.ts:168).
    test('should return undefined for whitespace-only input via the final catch', () => {
        expect(jsonComplete(' ')).toBeUndefined();
        expect(jsonComplete('  ')).toBeUndefined();
        expect(jsonComplete('\n')).toBeUndefined();
    });

    // --- Unrecoverable fragments: every one of these reaches complete.ts:167-169 ---
    // Each input produces a `completed` string that is STILL invalid JSON, so the second
    // `JSON.parse` throws and the final `catch` returns `undefined` (coverage for line 168).
    test('should return undefined when the repaired string is still invalid', () => {
        // Trailing garbage after a complete value: rule 4 has nothing to close.
        expect(jsonComplete('{"a":1}:junk')).toBeUndefined();
        expect(jsonComplete('{"a":1}{"b":2')).toBeUndefined();
        expect(jsonComplete('{"a":1} }')).toBeUndefined();
        // Empty member slots and stray structural characters survive the repair pass.
        expect(jsonComplete('{,}')).toBeUndefined();
        expect(jsonComplete('{"a"::1}')).toBeUndefined();
        expect(jsonComplete('["a",,"]')).toBeUndefined();
        expect(jsonComplete('[1,,2]')).toBeUndefined();
        expect(jsonComplete('{"a":1,]')).toBeUndefined();
        expect(jsonComplete('{"a":1,}')).toBeUndefined();
        expect(jsonComplete('[1,2}')).toBeUndefined();
        // A key with a colon but no value closes to `{"a":}` which is not valid JSON.
        expect(jsonComplete('{"a":')).toBeUndefined();
        expect(jsonComplete('{"a":1,"b": ')).toBeUndefined();
        // Numbers that JSON rejects (leading zero) are not repairable either.
        expect(jsonComplete('{"a":01')).toBeUndefined();
        expect(jsonComplete('{"a":+1}')).toBeUndefined();
        // Bare non-JSON tokens.
        expect(jsonComplete('a')).toBeUndefined();
        expect(jsonComplete('tru')).toBeUndefined();
        expect(jsonComplete('}')).toBeUndefined();
        expect(jsonComplete(']')).toBeUndefined();
        expect(jsonComplete(',')).toBeUndefined();
        expect(jsonComplete(':')).toBeUndefined();
    });

    // --- Non-string inputs (runtime contract, not the declared `string` signature) ---
    //
    // `JSON.parse` string-coerces its argument, so every non-string below fails the fast
    // path and falls into the repair pass, where the raw (non-string) value is used.
    // Pinned so the throw/return split stays exactly as measured.

    // `jsonString.length` (complete.ts:40) is the first member access on the raw value once
    // the fast path has been skipped — `undefined` has no `length`, so the guard itself throws.
    test('should throw TypeError for undefined input', () => {
        expect(() => jsonComplete(undefined as any)).toThrow(TypeError);
        expect(() => jsonComplete(undefined as any)).toThrow("Cannot read properties of undefined (reading 'length')");
    });

    // `{}` passes the length guard (`{}.length` is `undefined`, and `undefined === 0` is false),
    // the scan loop never runs (`0 < undefined` is false), so rule 3 (complete.ts:154) calls
    // `endsWith` on the original object.
    test('should throw TypeError when the repaired value has no endsWith', () => {
        expect(() => jsonComplete({} as any)).toThrow(TypeError);
        expect(() => jsonComplete({} as any)).toThrow('completed.endsWith is not a function');
    });

    // `JSON.parse(null)` -> "null" and `JSON.parse(42)` -> "42" are both valid JSON, so the
    // fast path (complete.ts:33-37) returns before any of the guards above is reached.
    test('should pass through null and number inputs via the fast path', () => {
        expect(jsonComplete(null as any)).toBeNull();
        expect(jsonComplete(42 as any)).toBe(42);
    });
});
