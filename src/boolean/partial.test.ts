import { booleanPartialFalse, booleanPartialTrue } from '@presource/core';

/**
 * Contract source: src/boolean/partial.ts (lines 23-36 / 46-60) driving src/boolean/cases.ts.
 *
 * Behaviour nailed down here:
 * - The nested-object rule (the `object:` branch of `booleanPartialTrue` and of
 *   `booleanPartialFalse` in partial.ts) is IDENTICAL in both helpers:
 *   `booleanPartialTrue(nested)` is used for recursion and an EMPTY nested object is
 *   hard-coded to `true`. booleanPartialFalse therefore never recurses into itself -
 *   documented upstream by the TODO at partial.ts:51. Observable consequence:
 *   `booleanPartialFalse({ a: { b: true, c: true } })` is `false` (a truthy-looking nested
 *   value cannot be a "false" signal), even though recursing into `booleanPartialFalse` instead would make it `true`.
 * - `booleanCases` short-circuits the walk as soon as the inner callback returns a
 *   non-undefined value, so the counters below prove the evaluation stops early.
 * - Leaves whose value is an array/date/instance are NOT treated as nested objects
 *   (typeName is 'array'/'date'/...), they are plain `!!value` coercions.
 */
describe('Testing booleanPartialTrue functionality', () => {
    test('Basic Usage', () => {
        expect(
            booleanPartialTrue({
                a: 0, // 0 is falsy
                b: '', // An empty string is falsy
                c: false, // false is falsy
                d: null, // null is falsy too
                e: undefined, // Same for undefined
            })
        ).toBe(false);

        expect(
            booleanPartialTrue({
                a: 0,
                b: 0,
                c: 1, // A single truthy leaf is enough to make the whole evaluation true!
                d: 0,
                e: 0,
            })
        ).toBe(true);
    });

    test('Advance Usage', () => {
        expect(
            booleanPartialTrue({
                a: false,
                b: null,
                c: undefined,
                d: {}, // An empty nested object is hard-coded truthy
            })
        ).toBe(true);

        expect(
            booleanPartialTrue({
                a: false,
                b: null,
                c: undefined,
                d: {
                    1: undefined, // The only nested leaf is falsy, so the recursion returns false
                },
            })
        ).toBe(false);
    });

    test('an empty cases object has no truthy condition', () => {
        expect(booleanPartialTrue({})).toBe(false);
    });

    test('non-object truthy leaves trigger the result', () => {
        expect(booleanPartialTrue({ a: 'text' })).toBe(true);
        expect(booleanPartialTrue({ a: NaN })).toBe(false);
        // [] is not routed through the recursive object branch, it coerces to true
        expect(booleanPartialTrue({ a: [] })).toBe(true);
    });

    test('function valued cases are evaluated when matched', () => {
        expect(booleanPartialTrue({ a: () => 0 })).toBe(false);
        expect(booleanPartialTrue({ a: () => 0, b: () => 1 })).toBe(true);
    });

    test('nested objects recurse', () => {
        expect(booleanPartialTrue({ a: { b: true, c: false } })).toBe(true);
        expect(booleanPartialTrue({ a: { b: false } })).toBe(false);
        expect(booleanPartialTrue({ a: { b: false, c: true } })).toBe(true);
        // An empty nested object is hard-coded truthy (partial.ts:28)
        expect(booleanPartialTrue({ a: {} })).toBe(true);
        expect(booleanPartialTrue({ a: 0, b: {} })).toBe(true);
        // A sibling condition can still satisfy the check on its own
        expect(booleanPartialTrue({ a: { b: false }, c: true })).toBe(true);
        expect(booleanPartialTrue({ a: { b: false }, c: false })).toBe(false);
    });

    test('three levels of nesting', () => {
        expect(booleanPartialTrue({ a: { b: { c: true } } })).toBe(true);
        expect(booleanPartialTrue({ a: { b: { c: false } } })).toBe(false);
        expect(booleanPartialTrue({ a: { b: { c: false }, d: true } })).toBe(true);
    });

    test('evaluation short-circuits on the first truthy condition', () => {
        let calls = 0;
        const result = booleanPartialTrue({
            a: () => {
                calls += 1;
                return 1;
            },
            b: () => {
                calls += 1;
                return 1;
            },
        });

        // booleanCases breaks the walk when the inner callback returns a value
        expect(calls).toBe(1);
        expect(result).toBe(true);

        calls = 0;
        const skipped = booleanPartialTrue({
            a: () => {
                calls += 1;
                return 0;
            },
            b: () => {
                calls += 1;
                return 1;
            },
            c: () => {
                calls += 1;
                return 1;
            },
        });

        expect(calls).toBe(2);
        expect(skipped).toBe(true);
    });
});

describe('booleanPartialFalse test', () => {
    test('Basic usage of booleanPartialFalse', () => {
        // Every leaf here is falsy, so a falsy signal exists and the result is true
        expect(booleanPartialFalse({ a: 0, b: false, c: undefined, d: null })).toBe(true);
        expect(booleanPartialFalse({ a: 0, b: true, c: undefined, d: null })).toBe(true);
        expect(booleanPartialFalse({ a: 1, b: false, c: undefined, d: null })).toBe(true);
        expect(booleanPartialFalse({ a: {} })).toBe(false);
        expect(booleanPartialFalse({ a: { 1: true, 2: 1 } })).toBe(false);
        expect(booleanPartialFalse({ a: { 1: false, 2: 1 } })).toBe(true);
    });

    test('flat fixtures', () => {
        expect(booleanPartialFalse({})).toBe(false);
        expect(booleanPartialFalse({ a: 0 })).toBe(true);
        expect(booleanPartialFalse({ a: 1, b: 'x', c: true, d: {} })).toBe(false);
        expect(booleanPartialFalse({ a: 0, b: '', c: false, d: null })).toBe(true);
        expect(booleanPartialFalse({ a: NaN })).toBe(true);
        // [] coerces truthy through the default branch, so nothing is falsy
        expect(booleanPartialFalse({ a: [] })).toBe(false);
    });

    test('function valued cases are evaluated when matched', () => {
        expect(booleanPartialFalse({ a: () => 1, b: () => 1 })).toBe(false);
        expect(booleanPartialFalse({ a: () => 1, b: () => 0 })).toBe(true);
    });

    test('nested objects keep the booleanPartialTrue recursion (partial.ts:51 TODO)', () => {
        expect(booleanPartialFalse({ a: false })).toBe(true);
        expect(booleanPartialFalse({ a: { b: false, c: true } })).toBe(true);
        expect(booleanPartialFalse({ a: { b: true, c: false } })).toBe(true);
        // All-truthy nested leaves: the nested value is judged by booleanPartialTrue,
        // so it counts as truthy and no falsy signal is produced
        expect(booleanPartialFalse({ a: { b: true, c: true } })).toBe(false);
        expect(booleanPartialFalse({ a: {} })).toBe(false);
        expect(booleanPartialFalse({ a: {}, b: true })).toBe(false);
        expect(booleanPartialFalse({ a: {}, b: false })).toBe(true);
    });

    test('three levels of nesting', () => {
        expect(booleanPartialFalse({ a: { b: { c: false } } })).toBe(true);
        expect(booleanPartialFalse({ a: { b: { c: true } } })).toBe(false);
        expect(booleanPartialFalse({ a: { b: { c: true } }, d: true })).toBe(false);
        expect(booleanPartialFalse({ a: { b: { c: false } }, d: true })).toBe(true);
    });

    test('evaluation short-circuits on the first falsy condition', () => {
        let calls = 0;
        const result = booleanPartialFalse({
            a: () => {
                calls += 1;
                return 1;
            },
            b: () => {
                calls += 1;
                return 0;
            },
            c: () => {
                calls += 1;
                return 0;
            },
        });

        // 'c' is never evaluated once a falsy condition has been found
        expect(calls).toBe(2);
        expect(result).toBe(true);

        calls = 0;
        const nested = booleanPartialFalse({
            a: {
                b: () => {
                    calls += 1;
                    return true;
                },
                c: () => {
                    calls += 1;
                    return false;
                },
            },
            d: () => {
                calls += 1;
                return false;
            },
        });

        // The nested falsy still records the result, but its feedback is truthy for the
        // parent, so the outer walk continues to 'd' (3 evaluations in total)
        expect(calls).toBe(3);
        expect(nested).toBe(true);

        calls = 0;
        const allTruthy = booleanPartialFalse({
            a: () => {
                calls += 1;
                return 1;
            },
            b: () => {
                calls += 1;
                return 1;
            },
            c: () => {
                calls += 1;
                return 1;
            },
        });

        // Nothing short-circuits when every condition is truthy
        expect(calls).toBe(3);
        expect(allTruthy).toBe(false);
    });
});
