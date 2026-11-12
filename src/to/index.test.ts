import * as toModule from './index';
import { toString } from '@presource/core';

/**
 * src/to/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the single `export *` line in
 * src/to/index.ts (line 6): toString (src/to/string.ts:18).
 *
 * NOTE the original version of this file asserted `typeSwitch`, which belongs to
 * src/type (not this barrel); the correct subject is `toString`. `toString` shadows
 * nothing at runtime — ESM namespace objects are null-prototype, so the exported key is
 * the module's own and not Object.prototype.toString.
 */
const EXPECTED_EXPORTS = ['toString'];

describe('to barrel (src/to/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(toModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('the single published export is a live function', () => {
        // Explicit own-key presence check: `toString` is an Object.prototype name, so a
        // missing export could masquerade as a function through prototype lookup.
        expect(Object.prototype.hasOwnProperty.call(toModule, 'toString')).toBe(true);
        expect(Object.fromEntries(Object.entries(toModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(toModule.toString).toBe(toString);
    });

    test('the re-exported toString converts exactly (string.ts:18-40)', () => {
        // Zero arguments hit the `0` case
        expect(toModule.toString()).toBe('');
        // Single primitive delegates through typeSwitch's default branch
        expect(toModule.toString(123)).toBe('123');
        expect(toModule.toString('x')).toBe('x');
        // null / undefined resolve to the sentinel literals
        expect(toModule.toString(null)).toBe('null');
        expect(toModule.toString(undefined)).toBe('undefined');
        // Objects and arrays are JSON-stringified
        expect(toModule.toString({ a: 1 })).toBe('{"a":1}');
        expect(toModule.toString([1, 2])).toBe('[1,2]');
    });

    test('multiple arguments currently return the mapped array (documented source bug)', () => {
        // src/to/string.ts:38 `// TODO: pending - BUG: Returns string[] for multiple args
        // but signature declares string` — pinned as-is so a future fix is a deliberate,
        // visible change rather than a silent behaviour shift.
        expect(toModule.toString('a', 'b') as unknown).toStrictEqual(['a', 'b']);
    });
});
