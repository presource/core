import * as numberModule from './index';
import { numberEnsures } from '@presource/core';

/**
 * src/number/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the single `export *` line in
 * src/number/index.ts (line 6): numberEnsures (src/number/ensures.ts:10).
 * That is the whole module — one function, no type-only exports.
 */
const EXPECTED_EXPORTS = ['numberEnsures'];

describe('number barrel (src/number/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(numberModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(numberModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(numberModule.numberEnsures).toBe(numberEnsures);
    });

    test('the re-exported numberEnsures still coerces exactly (ensures.ts:10-16)', () => {
        expect(numberModule.numberEnsures('42')).toBe(42);
        expect(numberModule.numberEnsures(true)).toBe(1);
        // Falsy input short-circuits to 0, and NaN results are normalised to 0
        expect(numberModule.numberEnsures('abc')).toBe(0);
        expect(numberModule.numberEnsures('')).toBe(0);
        expect(numberModule.numberEnsures(null)).toBe(0);
        expect(numberModule.numberEnsures(undefined)).toBe(0);
        expect(numberModule.numberEnsures(0)).toBe(0);
    });

    // --- pre-existing behavioural smoke check (kept from the original thin file) ---

    test('should export numberEnsures', () => {
        expect(numberEnsures).toBeInstanceOf(Function);
    });
});
