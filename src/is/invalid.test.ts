import { isInvalid } from './invalid';

describe('isInvalid', () => {
    test('should return true for null', () => {
        expect(isInvalid(null)).toBe(true);
    });

    test('should return true for undefined', () => {
        expect(isInvalid(undefined)).toBe(true);
    });

    test('should return false for valid values', () => {
        expect(isInvalid('')).toBe(false);
        expect(isInvalid(0)).toBe(false);
        expect(isInvalid(false)).toBe(false);
        expect(isInvalid([])).toBe(false);
        expect(isInvalid({})).toBe(false);
        expect(isInvalid(() => {})).toBe(false);
    });

    // Strict null/undefined checks only: every other falsy value is NOT invalid.
    test('falsy but non-nullish values are not invalid', () => {
        expect(isInvalid(NaN)).toBe(false);
        expect(isInvalid(0)).toBe(false);
        expect(isInvalid(-0)).toBe(false);
        expect(isInvalid('')).toBe(false);
        expect(isInvalid(false)).toBe(false);
        expect(isInvalid(0n)).toBe(false);
        expect(isInvalid([])).toBe(false);
        expect(isInvalid({})).toBe(false);
    });

    // Object-ish and exotic values are all "valid" under nullish semantics.
    test('object-ish and exotic values are not invalid', () => {
        expect(isInvalid(Object.create(null))).toBe(false);
        expect(isInvalid(Symbol('s'))).toBe(false);
        expect(isInvalid(Math)).toBe(false);
        expect(isInvalid(new Date(0))).toBe(false);
        expect(isInvalid(new Error('x'))).toBe(false);
        expect(isInvalid(Promise.resolve())).toBe(false);
        expect(isInvalid(new Map())).toBe(false);
        expect(isInvalid(/a/)).toBe(false);
        expect(isInvalid(class Sample {})).toBe(false);
    });

    // Boxed wrappers are objects, never nullish.
    test('boxed primitives are not invalid', () => {
        expect(isInvalid(new Number(0))).toBe(false);
        expect(isInvalid(new String(''))).toBe(false);
        expect(isInvalid(new Boolean(false))).toBe(false);
    });
});
