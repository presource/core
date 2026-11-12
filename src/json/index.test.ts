import * as jsonModule from './index';
import { jsonStringify } from '@presource/core';

/**
 * src/json/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the four `export *` lines in
 * src/json/index.ts (lines 8-11) and the runtime exports of each source file:
 *   ./complete   -> jsonComplete   (src/json/complete.ts:31)
 *   ./stringify  -> jsonStringify  (src/json/stringify.ts:52)
 *   ./table      -> jsonTable      (src/json/table.ts:46)
 *   ./update     -> jsonUpdate     (src/json/update.ts:29)
 *
 * `JsonTable` / `Configuration` (table.ts) are type-only.
 */
const EXPECTED_EXPORTS = ['jsonComplete', 'jsonStringify', 'jsonTable', 'jsonUpdate'];

describe('json barrel (src/json/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(jsonModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(jsonModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(jsonModule.jsonStringify).toBe(jsonStringify);
    });

    test('the re-exported jsonStringify still omits true cycles (stringify.ts:52-90)', () => {
        expect(jsonModule.jsonStringify({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
        const circular: any = { name: 'root' };
        circular.self = circular;
        expect(jsonModule.jsonStringify(circular)).toBe('{"name":"root"}');
    });

    test('the re-exported jsonComplete still repairs truncated JSON (complete.ts:31+)', () => {
        expect(jsonModule.jsonComplete('{"a":1')).toStrictEqual({ a: 1 });
        expect(jsonModule.jsonComplete('{"a":1,"b":[2,3')).toStrictEqual({ a: 1, b: [2, 3] });
        // Empty input cannot be completed
        expect(jsonModule.jsonComplete('')).toBeUndefined();
    });

    // --- pre-existing behavioural smoke check (kept from the original thin file) ---

    test('should export jsonStringify', () => {
        expect(jsonStringify).toBeInstanceOf(Function);
    });
});
