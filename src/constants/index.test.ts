import * as constants from './index';

/**
 * src/constants/index.ts barrel contract.
 *
 * This file was 0 bytes before the constants gap was fixed, so every documented
 * constant resolved to `undefined` through `@presource/core`. It now publishes exactly
 * one re-export line (`export * from './strings'`, index.ts:11) whose runtime surface
 * is the six literals declared in src/constants/strings.ts:13-28:
 *   EMPTY_STRING(13) SPACE_STRING(16) NUMBERS_STRING(19) ALPHABET_STRING(22)
 *   NULL_STRING(25) UNDEFINED_STRING(28)
 *
 * The list is hand-derived from those source lines — it is not generated from a test
 * run — so an added, renamed, or accidentally re-exported constant fails here.
 */
const EXPECTED_EXPORTS = [
    'ALPHABET_STRING',
    'EMPTY_STRING',
    'NULL_STRING',
    'NUMBERS_STRING',
    'SPACE_STRING',
    'UNDEFINED_STRING',
];

describe('constants barrel (src/constants/index.ts)', () => {
    test('publishes exactly the six documented constant names', () => {
        expect(Object.keys(constants).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a string literal (none are type-only or undefined)', () => {
        // Object.fromEntries removes key-ordering concerns; the expectation is derived
        // from the source-derived name list above, not from the observed namespace.
        expect(Object.fromEntries(Object.entries(constants).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'string'])));
    });

    test('the barrel surfaces the exact literal values, not just the names', () => {
        // Regression guard: a barrel that re-exports the wrong module would still
        // produce matching names only by coincidence, so values are pinned too.
        expect({
            ALPHABET_STRING: constants.ALPHABET_STRING,
            EMPTY_STRING: constants.EMPTY_STRING,
            NULL_STRING: constants.NULL_STRING,
            NUMBERS_STRING: constants.NUMBERS_STRING,
            SPACE_STRING: constants.SPACE_STRING,
            UNDEFINED_STRING: constants.UNDEFINED_STRING,
        }).toStrictEqual({
            ALPHABET_STRING: 'abcdefghijklmnopqrstuvwxyz',
            EMPTY_STRING: '',
            NULL_STRING: 'null',
            NUMBERS_STRING: '0123456789',
            SPACE_STRING: ' ',
            UNDEFINED_STRING: 'undefined',
        });
    });
});
