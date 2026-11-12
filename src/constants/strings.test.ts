import {
    ALPHABET_STRING,
    EMPTY_STRING,
    NULL_STRING,
    NUMBERS_STRING,
    SPACE_STRING,
    UNDEFINED_STRING,
} from './strings';
import { toString } from '../to';

/**
 * Literal string constants (src/constants/strings.ts).
 *
 * These values are the canonical "never hand-type a sentinel" strings documented in
 * `knowledge.md`. They are consumed through the root barrel by
 * `scripts/clean-temp.ts` and `scripts/sync-versions.ts`, so an accidental edit to a
 * literal here (or a dropped `export *` in src/constants/index.ts / src/index.ts) has
 * to fail loudly.
 *
 * Every expectation below is an independent literal / independently generated
 * sequence — none of them are derived from the constant under test.
 */

// Expected digit/letter sequences built from ASCII code points (48-57, 97-122) so the
// ascending-order assertion does not read from the value being asserted.
const EXPECTED_DIGITS = Array.from({ length: 10 }, (_, index) => String.fromCharCode(48 + index)).join('');
const EXPECTED_LETTERS = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index)).join('');

describe('string constants (src/constants/strings.ts)', () => {
    test('EMPTY_STRING is exactly the empty string (strings.ts:13)', () => {
        expect(EMPTY_STRING).toBe('');
        expect(typeof EMPTY_STRING).toBe('string');
        expect(EMPTY_STRING.length).toBe(0);
    });

    test('SPACE_STRING is exactly one space character (strings.ts:16)', () => {
        expect(SPACE_STRING).toBe(' ');
        expect(typeof SPACE_STRING).toBe('string');
        expect(SPACE_STRING.length).toBe(1);
        // Canonical join/split separator contract
        expect('a b c'.split(SPACE_STRING)).toStrictEqual(['a', 'b', 'c']);
        expect(['a', 'b', 'c'].join(SPACE_STRING)).toBe('a b c');
    });

    test('NUMBERS_STRING is exactly digits 0-9 in order (strings.ts:19)', () => {
        expect(NUMBERS_STRING).toBe('0123456789');
        expect(typeof NUMBERS_STRING).toBe('string');
        // Length and ordering pinned against an independently generated sequence
        expect(NUMBERS_STRING.length).toBe(10);
        expect(NUMBERS_STRING).toBe(EXPECTED_DIGITS);
        expect(NUMBERS_STRING.split('')).toStrictEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
        expect([...NUMBERS_STRING].map((char) => char.charCodeAt(0))).toStrictEqual([48, 49, 50, 51, 52, 53, 54, 55, 56, 57]);
    });

    test('ALPHABET_STRING is exactly lowercase a-z in order (strings.ts:22)', () => {
        expect(ALPHABET_STRING).toBe('abcdefghijklmnopqrstuvwxyz');
        expect(typeof ALPHABET_STRING).toBe('string');
        // Lowercase only: 26 characters, no uppercase, no digits
        expect(ALPHABET_STRING.length).toBe(26);
        expect(ALPHABET_STRING).toBe(EXPECTED_LETTERS);
        expect(ALPHABET_STRING.toLowerCase()).toBe(ALPHABET_STRING);
        expect([...ALPHABET_STRING].map((char) => char.charCodeAt(0))).toStrictEqual([
            97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
            110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
        ]);
    });

    test('NULL_STRING is exactly the literal "null" (strings.ts:25)', () => {
        expect(NULL_STRING).toBe('null');
        expect(typeof NULL_STRING).toBe('string');
        expect(NULL_STRING.length).toBe(4);
        // Cross-reference: matches the native stringification of null
        expect(NULL_STRING).toBe(String(null));
    });

    test('UNDEFINED_STRING is exactly the literal "undefined" (strings.ts:28)', () => {
        expect(UNDEFINED_STRING).toBe('undefined');
        expect(typeof UNDEFINED_STRING).toBe('string');
        expect(UNDEFINED_STRING.length).toBe(9);
        // Cross-reference: matches the native stringification of undefined
        expect(UNDEFINED_STRING).toBe(String(undefined));
    });

    test('the six constants are six distinct values with no duplicates', () => {
        // EMPTY_STRING is the only zero-length value; the sentinel strings must not
        // collide with each other or with the separators.
        const values = [EMPTY_STRING, SPACE_STRING, NUMBERS_STRING, ALPHABET_STRING, NULL_STRING, UNDEFINED_STRING];
        expect(values).toStrictEqual(['', ' ', '0123456789', 'abcdefghijklmnopqrstuvwxyz', 'null', 'undefined']);
        expect(new Set(values).size).toBe(6);
        expect(values.map((value) => value.length)).toStrictEqual([0, 1, 10, 26, 4, 9]);
    });

    test('the sentinels match the library converter they document (src/to/string.ts:18-40)', () => {
        // toString() with no args is the empty-string branch, and toString(null /
        // undefined) hardcodes the same sentinel text — these cross-references fail if
        // either side of the contract drifts.
        expect(toString()).toBe(EMPTY_STRING);
        expect(toString(null)).toBe(NULL_STRING);
        expect(toString(undefined)).toBe(UNDEFINED_STRING);
    });
});
