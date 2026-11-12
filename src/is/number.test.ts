import { isNumber } from './number';

describe('isNumber', () => {
    test('should return true for numbers', () => {
        expect(isNumber(123)).toBe(true);
        expect(isNumber(0)).toBe(true);
        expect(isNumber(-1)).toBe(true);
        expect(isNumber(1.5)).toBe(true);
        expect(isNumber(Infinity)).toBe(true);
        expect(isNumber(-Infinity)).toBe(true);
    });

    test('should return false for non-numbers', () => {
        expect(isNumber('123')).toBe(false);
        expect(isNumber(null)).toBe(false);
        expect(isNumber(undefined)).toBe(false);
        expect(isNumber(true)).toBe(false);
        expect(isNumber([])).toBe(false);
        expect(isNumber({})).toBe(false);
        expect(isNumber(() => {})).toBe(false);
    });

    // The guard compares the CONSTRUCTOR, so special numeric values still qualify.
    test('special numeric values are numbers', () => {
        expect(isNumber(NaN)).toBe(true);
        expect(isNumber(-0)).toBe(true);
        expect(isNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
        expect(isNumber(Number.MIN_SAFE_INTEGER)).toBe(true);
        expect(isNumber(Number.EPSILON)).toBe(true);
        expect(isNumber(1e-323)).toBe(true);
    });

    // Boxed numbers (and objects inheriting Number.prototype) share the Number constructor.
    test('boxed numbers are numbers', () => {
        expect(isNumber(new Number(5))).toBe(true);
        expect(isNumber(new Number(NaN))).toBe(true);
        expect(isNumber(Object.create(Number.prototype))).toBe(true);
    });

    // Numeric-looking strings and bigint are NOT numbers under this guard.
    test('numeric look-alikes are not numbers', () => {
        expect(isNumber('5')).toBe(false);
        expect(isNumber(new String('5'))).toBe(false);
        expect(isNumber(10n)).toBe(false);
        expect(isNumber(0n)).toBe(false);
        expect(isNumber(new Boolean(1))).toBe(false);
        expect(isNumber(Symbol('n'))).toBe(false);
    });

    // Object-ish values report other constructors, including Math and null-prototype objects.
    test('object-ish values are not numbers', () => {
        expect(isNumber(Math)).toBe(false);
        expect(isNumber(Object.create(null))).toBe(false);
        expect(isNumber(new Date(0))).toBe(false);
        expect(isNumber(Number)).toBe(false);
        expect(isNumber([1])).toBe(false);
        expect(isNumber({ valueOf: () => 1 })).toBe(false);
    });
});
