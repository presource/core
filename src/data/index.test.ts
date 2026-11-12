import * as dataModule from './index';
import { dataClone } from '@presource/core';

/**
 * src/data/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the two `export *` lines in
 * src/data/index.ts (lines 7-8) and the runtime exports of each source file:
 *   ./clone -> dataClone (src/data/clone.ts:40)
 *   ./list  -> dataList  (src/data/list.ts:78)
 *
 * `Structure` (clone.ts) and `DataList` (list.ts) are type-only.
 */
const EXPECTED_EXPORTS = ['dataClone', 'dataList'];

describe('data barrel (src/data/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(dataModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(dataModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(dataModule.dataClone).toBe(dataClone);
    });

    test('the re-exported dataClone still deep-clones independently (clone.ts:40-63)', () => {
        const original = { a: [1, 2, { b: 3 }] };
        const copy = dataModule.dataClone(original);
        expect(copy).toStrictEqual({ a: [1, 2, { b: 3 }] });
        // Deep clone: mutating a nested value in the copy must not touch the original
        (copy as any).a[2].b = 99;
        expect(original).toStrictEqual({ a: [1, 2, { b: 3 }] });
        // Primitives fall through the `default` branch unchanged
        expect(dataModule.dataClone('x')).toBe('x');
        expect(dataModule.dataClone(7)).toBe(7);
        expect(dataModule.dataClone(null)).toBeNull();
    });

    // --- pre-existing behavioural smoke check (kept from the original thin file) ---

    test('should export dataClone', () => {
        expect(dataClone).toBeInstanceOf(Function);
    });
});
