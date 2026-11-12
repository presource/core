import { booleanTrue } from './true';

/**
 * Contract source: src/boolean/true.ts (lines 19-25) driving src/boolean/cases.ts.
 *
 * Behaviour nailed down here:
 * - `result` starts as `true`, so an EMPTY cases object returns `true` (nothing to refute it).
 * - Unlike the partial helpers there is no nested-object branch: the callback simply checks
 *   `if (!value)`. A nested object therefore only fails when an inner leaf short-circuits -
 *   `booleanCases` returns that falsy feedback as the parent's evaluated value (cases.ts:49/68).
 *   A nested object whose leaves are all truthy comes back as a truthy accumulator object.
 * - Returning `false` from the callback is a non-undefined feedback, so the walk stops at the
 *   first falsy condition.
 */
describe('Testing booleanTrue function', () => {
    test('Basic Usage', () => {
        // Expect Everything to Return True
        expect(
            booleanTrue({
                a: 1,
                b: {}, // Object is Special. Since it is an empty object, it should consider to be true
                c: [],
                d: () => 1,
            })
        ).toBe(true);

        expect(
            booleanTrue({
                a: 1,
                b: 2,
                c: 0, // This will return false, making the whole argument false.
                d: 4,
            })
        ).toBe(false);
    });

    test('Advance Usage', () => {
        // Nested Expression via Object
        // True Test
        expect(
            booleanTrue({
                simple: 1,
                function: () => 2,
                nested: {
                    a: 1,
                    b: 2,
                    c: 3,
                },
            })
        ).toBe(true);

        // False Test
        expect(
            booleanTrue({
                simple: 1,
                function: () => 2,
                nested: {
                    a: 1,
                    b: undefined, // This should trigger everything to be false!
                    c: false, // This should trigger everything to be false!
                },
            })
        ).toBe(false);
    });

    test('an empty cases object is vacuously true', () => {
        expect(booleanTrue({})).toBe(true);
    });

    test('single-value fixtures', () => {
        expect(booleanTrue({ a: 1 })).toBe(true);
        expect(booleanTrue({ a: 'text' })).toBe(true);
        expect(booleanTrue({ a: 0 })).toBe(false);
        expect(booleanTrue({ a: '' })).toBe(false);
        expect(booleanTrue({ a: false })).toBe(false);
        expect(booleanTrue({ a: null })).toBe(false);
        expect(booleanTrue({ a: undefined })).toBe(false);
        expect(booleanTrue({ a: NaN })).toBe(false);
    });

    test('every falsy leaf makes the whole object false', () => {
        expect(booleanTrue({ a: 0, b: '', c: false, d: null, e: undefined })).toBe(false);
    });

    test('non-object containers coerce truthy through the default branch', () => {
        expect(booleanTrue({ a: [] })).toBe(true);
        expect(booleanTrue({ a: [0] })).toBe(true);
        expect(booleanTrue({ a: new Date(0) })).toBe(true);
    });

    test('function valued cases are evaluated with the accumulated result', () => {
        expect(booleanTrue({ a: () => 1, b: () => 2 })).toBe(true);
        expect(booleanTrue({ a: () => 1, b: () => 0 })).toBe(false);
    });

    test('nested objects propagate a falsy leaf from any depth', () => {
        expect(booleanTrue({ a: { b: { c: 1 } } })).toBe(true);
        expect(booleanTrue({ a: { b: { c: 0 } } })).toBe(false);
        expect(booleanTrue({ a: { b: false } })).toBe(false);
        // The falsy inner feedback is re-checked by the parent callback, so later siblings cannot rescue it
        expect(booleanTrue({ a: { b: true, c: false }, d: 1 })).toBe(false);
    });

    test('empty nested containers stay truthy', () => {
        expect(booleanTrue({ a: {} })).toBe(true);
        expect(booleanTrue({ a: { b: {} } })).toBe(true);
    });

    test('evaluation short-circuits on the first falsy condition', () => {
        let calls = 0;
        const result = booleanTrue({
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
                return 1;
            },
        });

        // 'c' is never reached because the falsy feedback breaks the walk
        expect(calls).toBe(2);
        expect(result).toBe(false);

        calls = 0;
        const allTrue = booleanTrue({
            a: () => {
                calls += 1;
                return 1;
            },
            b: () => {
                calls += 1;
                return 1;
            },
        });

        expect(calls).toBe(2);
        expect(allTrue).toBe(true);
    });
});
