import { isBoolean, isBooleanTrue, isBooleanFalse } from '@presource/core';

// For Checking Standard Boolean Type
describe('Checking value is a Boolean Type', () => {
    test('boolean values should return true', () => {
        expect(isBoolean(false)).toEqual(true);
        expect(isBoolean(true)).toEqual(true);
    });

    test('Non-boolean values should return false', () => {
        expect(isBoolean('')).toEqual(false);
        expect(isBoolean('string')).toEqual(false);
        expect(isBoolean([])).toEqual(false);
        expect(isBoolean([1, 2, 3, 4])).toEqual(false);
        expect(isBoolean(() => {})).toEqual(false);
        expect(isBoolean(1)).toEqual(false);
        expect(isBoolean(2)).toEqual(false);
        expect(isBoolean({})).toEqual(false);
        expect(isBoolean({ value: 1 })).toEqual(false);
        expect(isBoolean(undefined)).toEqual(false);
        expect(isBoolean(null)).toEqual(false);
    });

    // isBoolean compares the CONSTRUCTOR, so a Boolean wrapper object also passes
    // while truthy/falsy look-alikes (0, '', 'true', NaN) do not.
    test('boxed Boolean wrappers should return true', () => {
        expect(isBoolean(new Boolean(true))).toBe(true);
        expect(isBoolean(new Boolean(false))).toBe(true);
        // Objects inheriting Boolean.prototype resolve to the Boolean constructor too
        expect(isBoolean(Object.create(Boolean.prototype))).toBe(true);
    });

    test('boolean look-alike values should return false', () => {
        expect(isBoolean(0)).toBe(false);
        expect(isBoolean(1)).toBe(false);
        expect(isBoolean(NaN)).toBe(false);
        expect(isBoolean('true')).toBe(false);
        expect(isBoolean('false')).toBe(false);
        expect(isBoolean(10n)).toBe(false);
        expect(isBoolean(Symbol('s'))).toBe(false);
        expect(isBoolean(new Date(0))).toBe(false);
        expect(isBoolean(Math)).toBe(false);
        expect(isBoolean(Object.create(null))).toBe(false);
    });
});

describe('Checking value is strictly true / false', () => {
    // isBooleanTrue uses `value === true`, so only the primitive `true` passes.
    test('isBooleanTrue only accepts the primitive true', () => {
        expect(isBooleanTrue(true)).toBe(true);
        expect(isBooleanTrue(false)).toBe(false);
        expect(isBooleanTrue(new Boolean(true))).toBe(false);
        expect(isBooleanTrue(1)).toBe(false);
        expect(isBooleanTrue('true')).toBe(false);
        expect(isBooleanTrue(0)).toBe(false);
        expect(isBooleanTrue('')).toBe(false);
        expect(isBooleanTrue(null)).toBe(false);
        expect(isBooleanTrue(undefined)).toBe(false);
        expect(isBooleanTrue(NaN)).toBe(false);
        expect(isBooleanTrue([])).toBe(false);
        expect(isBooleanTrue({})).toBe(false);
    });

    // isBooleanFalse uses `value === false`, so only the primitive `false` passes.
    test('isBooleanFalse only accepts the primitive false', () => {
        expect(isBooleanFalse(false)).toBe(true);
        expect(isBooleanFalse(true)).toBe(false);
        expect(isBooleanFalse(new Boolean(false))).toBe(false);
        expect(isBooleanFalse(0)).toBe(false);
        expect(isBooleanFalse('')).toBe(false);
        expect(isBooleanFalse('false')).toBe(false);
        expect(isBooleanFalse(null)).toBe(false);
        expect(isBooleanFalse(undefined)).toBe(false);
        expect(isBooleanFalse(NaN)).toBe(false);
        expect(isBooleanFalse([])).toBe(false);
        expect(isBooleanFalse({})).toBe(false);
    });

    // A boxed wrapper passes the constructor check but fails both strict equality checks.
    test('boxed wrappers are booleans by constructor but never strictly true or false', () => {
        const wrapper = new Boolean(true);
        expect(isBoolean(wrapper)).toBe(true);
        expect(isBooleanTrue(wrapper)).toBe(false);
        expect(isBooleanFalse(wrapper)).toBe(false);

        const falseWrapper = new Boolean(false);
        expect(isBoolean(falseWrapper)).toBe(true);
        expect(isBooleanTrue(falseWrapper)).toBe(false);
        expect(isBooleanFalse(falseWrapper)).toBe(false);
    });
});
