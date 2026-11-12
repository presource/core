import { isValid } from './valid';
import { isInvalid } from './invalid';

describe('isValid', () => {
    test('should return true for valid values', () => {
        expect(isValid('hello')).toBe(true);
        expect(isValid(123)).toBe(true);
        expect(isValid(true)).toBe(true);
        expect(isValid([1, 2, 3])).toBe(true);
        expect(isValid({ key: 'value' })).toBe(true);
    });

    test('should return false for null', () => {
        expect(isValid(null)).toBe(false);
    });

    test('should return false for undefined', () => {
        expect(isValid(undefined)).toBe(false);
    });

    test('should return true for empty string', () => {
        expect(isValid('')).toBe(true);
    });

    test('should return true for empty array', () => {
        expect(isValid([])).toBe(true);
    });

    test('should return true for empty object', () => {
        expect(isValid({})).toBe(true);
    });

    test('should return true for zero', () => {
        expect(isValid(0)).toBe(true);
    });

    test('should return true for false', () => {
        expect(isValid(false)).toBe(true);
    });

    // isValid is the exact negation of isInvalid: only null/undefined are invalid,
    // so every falsy-but-present value stays valid.
    test('every falsy-but-present value is valid', () => {
        expect(isValid(NaN)).toBe(true);
        expect(isValid(-0)).toBe(true);
        expect(isValid(0)).toBe(true);
        expect(isValid('')).toBe(true);
        expect(isValid(false)).toBe(true);
        expect(isValid(0n)).toBe(true);
        expect(isValid([])).toBe(true);
        expect(isValid({})).toBe(true);
    });

    test('object-ish and exotic values are valid', () => {
        expect(isValid(Object.create(null))).toBe(true);
        expect(isValid(Symbol('s'))).toBe(true);
        expect(isValid(Math)).toBe(true);
        expect(isValid(new Date(0))).toBe(true);
        expect(isValid(new Error('x'))).toBe(true);
        expect(isValid(Promise.resolve())).toBe(true);
        expect(isValid(new Map())).toBe(true);
        expect(isValid(/a/)).toBe(true);
        expect(isValid(class Sample {})).toBe(true);
        expect(isValid(() => {})).toBe(true);
    });

    test('boxed primitives are valid', () => {
        expect(isValid(new Number(0))).toBe(true);
        expect(isValid(new String(''))).toBe(true);
        expect(isValid(new Boolean(false))).toBe(true);
    });

    // Cross-check the pair against one matrix so the two can never drift apart.
    test('isValid is the exact negation of isInvalid', () => {
        const values = [null, undefined, NaN, 0, '', false, 0n, [], {}, Math, Symbol('s'), Object.create(null)];
        // Only the two nullish entries are invalid; everything else is valid.
        expect(values.map((value) => isValid(value))).toStrictEqual([
            false, false, true, true, true, true, true, true, true, true, true, true
        ]);
        expect(values.map((value) => isInvalid(value))).toStrictEqual([
            true, true, false, false, false, false, false, false, false, false, false, false
        ]);
        expect(values.map((value) => isValid(value) === !isInvalid(value))).toStrictEqual(values.map(() => true));
    });
});
