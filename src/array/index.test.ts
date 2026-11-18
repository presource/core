import * as arrayModule from './index';
import { arrayCreate, arrayEach } from '@presource/core';

/**
 * src/array/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the `export *` lines in
 * src/array/index.ts and the runtime exports of each source file:
 *   ./create   -> arrayCreate (src/array/create.ts)
 *   ./each     -> arrayEach, arrayEachAsync (src/array/each.ts)
 *   ./ensures  -> arrayEnsures (src/array/ensures.ts)
 *   ./requeue  -> arrayRequeue (src/array/requeue.ts)
 *   ./shuffle  -> arrayShuffle (src/array/shuffle.ts)
 *   ./wrapper  -> arrayWrapper (src/array/wrapper/index.ts)
 *
 * Deliberately absent (type-only, erased at compile time): ArrayCreate, ArrayEach,
 * ArrayEachAsync, ArrayShuffle, Params. Also absent: the nine `*Function` helpers under
 * src/array/wrapper/methods/, which wrapper/index.ts imports privately and never
 * re-exports.
 */
const EXPECTED_EXPORTS = [
    'arrayCreate',
    'arrayEach',
    'arrayEachAsync',
    'arrayEnsures',
    'arrayRequeue',
    'arrayShuffle',
    'arrayWrapper',
];

describe('array barrel (src/array/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(arrayModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(arrayModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        // Guards against the barrel re-exporting a shadowed/duplicated symbol.
        expect(arrayModule.arrayCreate).toBe(arrayCreate);
        expect(arrayModule.arrayEach).toBe(arrayEach);
    });

    // --- pre-existing behavioural smoke checks (kept from the original thin file) ---

    test('should export arrayCreate', () => {
        expect(arrayCreate).toBeInstanceOf(Function);
    });

    test('should export arrayEach', () => {
        expect(arrayEach).toBeInstanceOf(Function);
    });
});
