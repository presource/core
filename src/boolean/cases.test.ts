import { booleanCases } from './cases';

/**
 * Contract source: src/boolean/cases.ts (lines 41-69).
 *
 * Behaviour nailed down here:
 * - Values are routed through `typeSwitch` (cases.ts:47-54) whose keys are derived from
 *   the lower-cased CONSTRUCTOR name: only real `object` values recurse, while arrays
 *   (`'array'`), dates (`'date'`), class instances, etc. fall through to `default: !!value`.
 * - Function values are called with the LIVE accumulator (`caseValue(result)`, cases.ts:51).
 * - The callback argument is `{ value, key, result }` where `result` is the same mutable
 *   accumulator object for every invocation - snapshots must be taken at call time.
 * - A non-`undefined` callback return short-circuits `objectEach` and is returned verbatim,
 *   even when it is falsy (`0` / `null`).
 * - When a nested recursion short-circuits, its feedback becomes the PARENT's evaluated
 *   value and the parent callback fires a second time with it.
 */
describe('booleanCases', () => {
    test('should evaluate cases and return results', () => {
        const cases = {
            numberTrue: () => 1,
            numberFalse: () => 0,
        };

        expect(booleanCases(cases)).toStrictEqual({ numberTrue: true, numberFalse: false });
    });

    test('coerces every raw value type and reports nested objects as recursion results', () => {
        const result = booleanCases({
            a: 1,
            b: 0,
            c: '',
            d: false,
            e: null,
            f: undefined,
            g: [],
            h: {},
            i: () => 0,
        });

        // [] is typeName 'array' (not 'object'), so it is coerced by `default: !!value`
        // {} IS typeName 'object', so it is replaced by the recursive accumulator: a fresh empty object
        expect(result).toStrictEqual({
            a: true,
            b: false,
            c: false,
            d: false,
            e: false,
            f: false,
            g: true,
            h: {},
            i: false,
        });
    });

    test('empty cases object produces an empty result', () => {
        expect(booleanCases({})).toStrictEqual({});
    });

    test('should support nested cases', () => {
        const cases = {
            outer: {
                inner: true,
            },
        };

        expect(booleanCases(cases)).toStrictEqual({ outer: { inner: true } });
    });

    test('nested objects recurse to any depth', () => {
        expect(booleanCases({ a: { b: { c: 1 } }, d: 0 })).toStrictEqual({
            a: { b: { c: true } },
            d: false,
        });
    });

    test('date and class instances are coerced through the default branch', () => {
        class Thing {}

        expect(booleanCases({ date: new Date(0), instance: new Thing(), text: 'x' })).toStrictEqual({
            date: true,
            instance: true,
            text: true,
        });
    });

    test('function values are called with the live accumulated result', () => {
        const seen: string[][] = [];
        const refs: any[] = [];
        const result = booleanCases({
            a: 1,
            b: (acc: any) => {
                seen.push(Object.keys(acc));
                refs.push(acc);
                return 0;
            },
            c: (acc: any) => {
                seen.push(Object.keys(acc));
                refs.push(acc);
                return 1;
            },
        });

        // Each function sees only the keys accumulated so far
        expect(seen).toStrictEqual([['a'], ['a', 'b']]);
        // ...and it is handed the very same object every time (cases.ts:51 passes `result`)
        expect(refs[0]).toBe(refs[1]);
        expect(result).toStrictEqual({ a: true, b: false, c: true });
    });

    test('callback receives value, key and result for every leaf including nested ones', () => {
        const calls: { keys: string[]; key: string; value: any; result: any }[] = [];

        const result = booleanCases({ a: true, b: { c: false } }, (args: any) => {
            calls.push({
                // Insertion order of the argument object built at cases.ts:59-63
                keys: Object.keys(args),
                key: args.key,
                value: args.value,
                // The accumulator is mutable, so it must be snapshotted at call time
                result: { ...args.result },
            });
            return undefined;
        });

        // The argument object is built as { value, key, result } (cases.ts:59-63)
        expect(calls).toStrictEqual([
            { keys: ['value', 'key', 'result'], key: 'a', value: true, result: { a: true } },
            { keys: ['value', 'key', 'result'], key: 'c', value: false, result: { c: false } },
            { keys: ['value', 'key', 'result'], key: 'b', value: { c: false }, result: { a: true, b: { c: false } } },
        ]);
        expect(result).toStrictEqual({ a: true, b: { c: false } });
    });

    test('should support callback with early return', () => {
        const cases = { a: true, b: false };

        expect(booleanCases(cases, () => true)).toBe(true);
    });

    test('any non-undefined callback return wins, even a falsy one', () => {
        const cases = { a: true, b: false };

        // `feedback !== undefined` (cases.ts:68) - so 0 and null are returned instead of the result
        expect(booleanCases(cases, ({ key }) => (key === 'a' ? 0 : undefined))).toBe(0);
        expect(booleanCases(cases, () => null)).toBeNull();

        // The first callback invocation stops the whole walk
        let calls = 0;
        const early = booleanCases({ a: 1, b: 2, c: 3 }, () => {
            calls += 1;
            return calls === 1 ? 'FIRST' : undefined;
        });

        expect(calls).toBe(1);
        expect(early).toBe('FIRST');
    });

    test('a callback that returns undefined yields the accumulated result object', () => {
        expect(booleanCases({ a: 1, b: 0 }, () => undefined)).toStrictEqual({ a: true, b: false });
        expect(booleanCases({ a: 1, b: 0 }, () => { })).toStrictEqual({ a: true, b: false });
    });

    test('should use custom caller for nested objects', () => {
        const customResult = { custom: true };
        const cases = {
            outer: {
                inner: true,
            },
            plain: true,
        };

        expect(booleanCases(cases, undefined, () => customResult)).toStrictEqual({
            outer: customResult,
            plain: true,
        });
    });

    test('the caller receives the raw nested object and its return becomes the value', () => {
        const seen: any[] = [];
        const result = booleanCases({ o: { deep: 1 } }, undefined, (value: any) => {
            seen.push(value);
            return 'CALL';
        });

        expect(seen).toStrictEqual([{ deep: 1 }]);
        expect(result).toStrictEqual({ o: 'CALL' });
    });

    test('the caller is never used for non-object values', () => {
        let callerCalls = 0;
        const result = booleanCases({ a: 1, b: () => 0, c: 'text' }, undefined, () => {
            callerCalls += 1;
            return 'CALLER';
        });

        expect(callerCalls).toBe(0);
        expect(result).toStrictEqual({ a: true, b: false, c: true });
    });

    test('a nested short-circuit becomes the parent value and re-fires the callback', () => {
        const args: [string, any][] = [];
        const result = booleanCases({ a: { x: false } }, ({ key, value }) => {
            args.push([key, value]);
            return value === false ? 'STOP' : undefined;
        });

        // The inner feedback 'STOP' is assigned to result.a and the parent callback runs again with it
        expect(args).toStrictEqual([['x', false], ['a', 'STOP']]);
        expect(result).toStrictEqual({ a: 'STOP' });
    });
});
