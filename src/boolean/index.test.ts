import * as booleanModule from './index';
import { booleanCases } from '@presource/core';

/**
 * src/boolean/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the three `export *` lines in
 * src/boolean/index.ts (lines 8-10) and the runtime exports of each source file:
 *   ./cases   -> booleanCases          (src/boolean/cases.ts:41)
 *   ./partial -> booleanPartialTrue    (src/boolean/partial.ts:23)
 *              -> booleanPartialFalse  (src/boolean/partial.ts:46)
 *   ./true    -> booleanTrue           (src/boolean/true.ts:19)
 *
 * `Cases`/`Callback` style helper types declared inside those files are type-only and
 * must not appear at runtime.
 */
const EXPECTED_EXPORTS = [
    'booleanCases',
    'booleanPartialFalse',
    'booleanPartialTrue',
    'booleanTrue',
];

describe('boolean barrel (src/boolean/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(booleanModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(booleanModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(booleanModule.booleanCases).toBe(booleanCases);
    });

    // --- pre-existing behavioural smoke check (kept from the original thin file) ---

    test('should export booleanCases', () => {
        expect(booleanCases).toBeInstanceOf(Function);
    });
});
