import { isString } from '@presource/core';

describe('Basic isString Test', () => {
    test('Primitive is a string or not', () => {
        expect(isString('')).toBeTruthy();
        expect(isString('this is a string')).toBeTruthy();

        // All These should return false.
        expect(isString(1)).toBeFalsy();
        expect(isString([])).toBeFalsy();
        expect(isString({})).toBeFalsy();
        expect(isString(undefined)).toBeFalsy();
        expect(isString(false)).toBeFalsy();
        expect(isString(true)).toBeFalsy();
        expect(isString(() => {})).toBeFalsy();
    });

    // The guard compares the CONSTRUCTOR to `String`, so every string primitive qualifies
    // (including the empty string) with an exact boolean result.
    test('every string primitive is a string', () => {
        expect(isString('')).toBe(true);
        expect(isString(' ')).toBe(true);
        expect(isString('this is a string')).toBe(true);
        expect(isString('\n\t')).toBe(true);
        expect(isString(String('a'))).toBe(true);
        expect(isString(String())).toBe(true);
        expect(isString(`${1 + 1}`)).toBe(true);
    });

    // Boxed strings report the String constructor, so they also pass (documented behaviour).
    test('String wrapper objects are strings', () => {
        expect(isString(new String('a'))).toBe(true);
        expect(isString(new String(''))).toBe(true);
        expect(isString(Object.create(String.prototype))).toBe(true);
    });

    // String-like values from other types are rejected, including String itself.
    test('string look-alikes and other values are not strings', () => {
        expect(isString(String)).toBe(false);
        expect(isString(new Number(1))).toBe(false);
        expect(isString(new Boolean(true))).toBe(false);
        expect(isString(1)).toBe(false);
        expect(isString(0)).toBe(false);
        expect(isString(NaN)).toBe(false);
        expect(isString(true)).toBe(false);
        expect(isString(false)).toBe(false);
        expect(isString(null)).toBe(false);
        expect(isString(undefined)).toBe(false);
        expect(isString(10n)).toBe(false);
        expect(isString(Symbol('s'))).toBe(false);
        expect(isString([])).toBe(false);
        expect(isString(['a'])).toBe(false);
        expect(isString({})).toBe(false);
        expect(isString({ toString: () => 'a' })).toBe(false);
        expect(isString(new Date(0))).toBe(false);
        expect(isString(/ab/g)).toBe(false);
        expect(isString(Math)).toBe(false);
        // Null-prototype objects have no constructor at all
        expect(isString(Object.create(null))).toBe(false);
    });
});
