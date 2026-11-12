import * as isModule from './index';
import { isValid, isInvalid } from '@presource/core';

/**
 * src/is/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the nine `export *` lines in
 * src/is/index.ts (lines 8-16) and the runtime exports of each source file:
 *   ./boolean  -> isBoolean (boolean.ts:17), isBooleanTrue (boolean.ts:26),
 *                 isBooleanFalse (boolean.ts:35)
 *   ./empty    -> isEmpty (empty.ts:27), isEmptyArray (empty.ts:51),
 *                 isEmptyObject (empty.ts:72)
 *   ./function -> isFunction (function.ts:23), isFunctionAsync (function.ts:36)
 *   ./invalid  -> isInvalid (invalid.ts:16)
 *   ./number   -> isNumber (number.ts:18)
 *   ./object   -> isObject (object.ts:17)
 *   ./promise  -> isPromise (promise.ts:16)
 *   ./string   -> isString (string.ts:17)
 *   ./valid    -> isValid (valid.ts:18)
 *
 * All the `unknown is X` predicates are runtime values; their type predicates are
 * erased but the functions themselves are published.
 */
const EXPECTED_EXPORTS = [
    'isBoolean',
    'isBooleanFalse',
    'isBooleanTrue',
    'isEmpty',
    'isEmptyArray',
    'isEmptyObject',
    'isFunction',
    'isFunctionAsync',
    'isInvalid',
    'isNumber',
    'isObject',
    'isPromise',
    'isString',
    'isValid',
];

describe('is barrel (src/is/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(isModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(isModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(isModule.isValid).toBe(isValid);
        expect(isModule.isInvalid).toBe(isInvalid);
    });

    test('the re-exported guards still return exact booleans', () => {
        // Constructor-identity guards (boolean.ts:17 / number.ts:18 / string.ts:17)
        expect(isModule.isBoolean(true)).toBe(true);
        expect(isModule.isBoolean('true')).toBe(false);
        expect(isModule.isNumber(1)).toBe(true);
        expect(isModule.isNumber('1')).toBe(false);
        expect(isModule.isString('x')).toBe(true);
        expect(isModule.isString(1)).toBe(false);
        // Strict literal guards (boolean.ts:26-41)
        expect(isModule.isBooleanTrue('')).toBe(false);
        expect(isModule.isBooleanTrue(true)).toBe(true);
        expect(isModule.isBooleanFalse(0)).toBe(false);
        expect(isModule.isBooleanFalse(false)).toBe(true);
    });

    // --- pre-existing behavioural smoke checks (kept from the original thin file) ---

    test('should export isValid', () => {
        expect(isValid).toBeInstanceOf(Function);
        expect(isValid('test')).toBe(true);
    });

    test('should export isInvalid', () => {
        expect(isInvalid).toBeInstanceOf(Function);
        expect(isInvalid(null)).toBe(true);
        expect(isInvalid(undefined)).toBe(true);
        expect(isInvalid('test')).toBe(false);
    });
});
