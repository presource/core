import { isObject } from '@presource/core';

describe('isObject Check', () => {
    test('Checking basic variables as object', () => {
        expect(isObject(null)).toBeFalsy();
        expect(isObject(true)).toBeFalsy();
        expect(isObject(false)).toBeFalsy();
        expect(isObject('object')).toBeFalsy();
        expect(isObject(1)).toBeFalsy();
        expect(isObject(() => {})).toBeFalsy();
        expect(isObject([])).toBeFalsy();
        expect(isObject({})).toBeTruthy();
        expect(isObject({ a: 1, b: 2 })).toBeTruthy();
    });

    // The guard compares the CONSTRUCTOR to `Object`, so it is exact rather than truthy-based.
    test('returns exactly true only for plain objects', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1, b: 2 })).toBe(true);
        expect(isObject({ nested: { deep: true } })).toBe(true);
        expect(isObject(Object.create(Object.prototype))).toBe(true);
        expect(isObject(Object.prototype)).toBe(true);
        // A proxy over a plain object still reports Object as its constructor
        expect(isObject(new Proxy({}, {}))).toBe(true);
    });

    test('class instances, built-ins and wrappers are not plain objects', () => {
        class Sample {}
        expect(isObject(new Sample())).toBe(false);
        expect(isObject(new (class extends Error {})())).toBe(false);
        expect(isObject(new Date(0))).toBe(false);
        expect(isObject(new Map())).toBe(false);
        expect(isObject(new Set())).toBe(false);
        expect(isObject(Promise.resolve())).toBe(false);
        expect(isObject(new Number(1))).toBe(false);
        expect(isObject(new String('a'))).toBe(false);
        expect(isObject(new Boolean(true))).toBe(false);
        expect(isObject(/ab/g)).toBe(false);
        expect(isObject(Error)).toBe(false);
        expect(isObject(() => {})).toBe(false);
        expect(isObject(class Sample2 {})).toBe(false);
    });

    test('primitives and nullish values are not plain objects', () => {
        expect(isObject(null)).toBe(false);
        expect(isObject(undefined)).toBe(false);
        expect(isObject(NaN)).toBe(false);
        expect(isObject(0)).toBe(false);
        expect(isObject('')).toBe(false);
        expect(isObject(false)).toBe(false);
        expect(isObject(10n)).toBe(false);
        expect(isObject(Symbol('s'))).toBe(false);
        expect(isObject([])).toBe(false);
    });

    // Null-prototype objects have NO constructor at all, so they are rejected even
    // though they are the most "plain" object imaginable (documented limitation).
    test('null-prototype objects are not detected as objects', () => {
        expect(isObject(Object.create(null))).toBe(false);
        expect(isObject(Object.assign(Object.create(null), { a: 1 }))).toBe(false);
    });

    // Math's constructor is Object, so the guard classifies it as a plain object.
    test('Math is treated as a plain object', () => {
        expect(isObject(Math)).toBe(true);
        expect(isObject(JSON)).toBe(true);
        expect(isObject(Math.random)).toBe(false);
    });
});
