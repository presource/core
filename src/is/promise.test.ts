import { isPromise } from '@presource/core';

describe('isPromise', () => {
    test('Basic promise check', () => {
        // The value is not a promise
        expect(isPromise((() => ({}))())).toBeFalsy();
        // The return value is a promise
        expect(isPromise((async () => {})())).toBeTruthy();
    });

    // The guard compares the CONSTRUCTOR to `Promise`, so any real promise instance qualifies.
    test('resolved, rejected and chained promises are promises', () => {
        expect(isPromise(Promise.resolve(1))).toBe(true);
        const rejected = Promise.reject(new Error('nope'));
        // Attach a handler so the rejection is not reported as unhandled
        rejected.catch(() => {});
        expect(isPromise(rejected)).toBe(true);
        expect(isPromise(Promise.resolve().then((value) => value))).toBe(true);
        expect(isPromise(new Promise((resolve) => resolve(1)))).toBe(true);
        // Objects inheriting Promise.prototype resolve to the Promise constructor
        expect(isPromise(Object.create(Promise.prototype))).toBe(true);
    });

    // Custom thenables are NOT promises here — duck typing is not accepted.
    test('thenables are not promises', () => {
        expect(isPromise({ then() {} })).toBe(false);
        expect(isPromise({ then() {}, catch() {} })).toBe(false);
        expect(isPromise({ then: () => {}, finally: () => {} })).toBe(false);
        // A Promise subclass instance has a different constructor
        class CustomPromise extends Promise {}
        const custom = new CustomPromise((resolve) => resolve(1));
        expect(isPromise(custom)).toBe(false);
    });

    test('non-promise values are not promises', () => {
        expect(isPromise(Promise)).toBe(false);
        expect(isPromise(async () => {})).toBe(false);
        expect(isPromise(undefined)).toBe(false);
        expect(isPromise(null)).toBe(false);
        expect(isPromise(Object.create(null))).toBe(false);
        expect(isPromise({})).toBe(false);
        expect(isPromise([])).toBe(false);
        expect(isPromise('then')).toBe(false);
        expect(isPromise(1)).toBe(false);
    });
});
