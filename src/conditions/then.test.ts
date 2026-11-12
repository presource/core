import { ifThen } from './then';

/**
 * Contract source: src/conditions/then.ts (lines 30-41) —
 * `if (!condition({ callback })) return; return callback({ condition });`
 * (a guard-clause rewrite of the previous one-liner; identical dispatch order).
 *
 * Behaviour nailed down here:
 * - The injection is one-shot: the condition is handed `{ callback }` and the callback is
 *   handed `{ condition }` (the exact same function references that were passed in).
 * - The two payload objects are separate objects with exactly one own key each; the payload
 *   for the skipped side is never allocated, so they cannot be merged into one shared record.
 * - Calling `condition(...)` from inside the callback re-runs ONLY the condition; it does not
 *   re-dispatch the callback, and ifThen itself never loops.
 * - The branch test is a plain `if`, so any truthy (non-boolean) condition return fires the callback.
 * - Missing functions throw TypeError, and errors raised inside the condition propagate.
 */
describe('ifThen Test', () => {
    test('condition true triggers callback', () => {
        let conditionCalled = false;
        let callbackCalled = false;

        ifThen(
            ({ callback }) => {
                conditionCalled = true;
                return true;
            },
            ({ condition }) => {
                callbackCalled = true;
            }
        );

        expect(conditionCalled).toBe(true);
        expect(callbackCalled).toBe(true);
    });

    test('condition false skips callback', () => {
        const result: any[] = [];
        const res = ifThen(
            () => false,
            () => {
                result.push('callback');
            }
        );

        expect(result).toStrictEqual([]);
        expect(res).toBeUndefined();
    });

    test('callback receives condition', () => {
        let receivedCondition: any;

        ifThen(
            () => true,
            ({ condition }) => {
                receivedCondition = condition;
            }
        );

        expect(typeof receivedCondition).toBe('function');
    });

    test('condition receives callback', () => {
        let receivedCallback: any;

        ifThen(
            ({ callback }) => {
                receivedCallback = callback;
                return false;
            },
            () => 'should not run'
        );

        expect(typeof receivedCallback).toBe('function');
    });

    test('each side is handed exactly one argument containing the other function', () => {
        const conditionArgs: any[] = [];
        const callbackArgs: any[] = [];
        const condition = (...args: any[]) => {
            conditionArgs.push(args);
            return true;
        };
        const callback = (...args: any[]) => {
            callbackArgs.push(args);
            return 'CB-RESULT';
        };

        const result = ifThen(condition, callback);

        expect(conditionArgs).toHaveLength(1);
        expect(conditionArgs[0]).toHaveLength(1);
        expect(Object.keys(conditionArgs[0][0])).toStrictEqual(['callback']);
        // The injected callback is the identical reference passed to ifThen
        expect(conditionArgs[0][0].callback).toBe(callback);

        expect(callbackArgs).toHaveLength(1);
        expect(callbackArgs[0]).toHaveLength(1);
        expect(Object.keys(callbackArgs[0][0])).toStrictEqual(['condition']);
        expect(callbackArgs[0][0].condition).toBe(condition);

        // ifThen returns whatever the callback returns
        expect(result).toBe('CB-RESULT');
    });

    test('the callback return value is forwarded as-is', () => {
        expect(ifThen(() => true, () => ({ obj: 1 }))).toStrictEqual({ obj: 1 });
        expect(ifThen(() => true, () => 0)).toBe(0);
        expect(ifThen(() => true, () => undefined)).toBeUndefined();
    });

    test('a truthy non-boolean condition still fires the callback', () => {
        const fired = () => 'ran';

        expect(ifThen(() => 1 as any, fired)).toBe('ran');
        expect(ifThen(() => 'x' as any, fired)).toBe('ran');
        expect(ifThen(() => [] as any, fired)).toBe('ran');
        expect(ifThen(() => ({}) as any, fired)).toBe('ran');
    });

    test('a falsy non-boolean condition skips the callback', () => {
        const fired = () => 'ran';

        expect(ifThen(() => '' as any, fired)).toBeUndefined();
        expect(ifThen(() => 0 as any, fired)).toBeUndefined();
        expect(ifThen(() => null as any, fired)).toBeUndefined();
        expect(ifThen(() => undefined as any, fired)).toBeUndefined();
        expect(ifThen(() => NaN as any, fired)).toBeUndefined();
    });

    test('recursive if-then chain', () => {
        const steps: number[] = [];
        const cond1 = ({ callback }: { callback: any }) => {
            steps.push(1);
            return true;
        };
        const cb1 = ({ condition }: { condition: any }) => {
            steps.push(2);
            ifThen(
                () => {
                    steps.push(3);
                    return true;
                },
                () => {
                    steps.push(4);
                }
            );
        };

        ifThen(cond1, cb1);

        expect(steps).toStrictEqual([1, 2, 3, 4]);
    });

    test('re-invoking the condition from the callback re-runs only the condition', () => {
        const steps: string[] = [];
        let runs = 0;
        const condition = () => {
            runs += 1;
            steps.push(`condition:${runs}`);
            // Only the very first evaluation is truthy
            return runs === 1;
        };
        const callback = ({ condition: cond }: any) => {
            steps.push('callback');
            steps.push(`first:${cond({ callback })}`);
            steps.push(`second:${cond({ callback })}`);
        };

        ifThen(condition, callback);

        // The callback ran once; every extra call went straight back to the condition
        expect(steps).toStrictEqual([
            'condition:1',
            'callback',
            'condition:2',
            'first:false',
            'condition:3',
            'second:false',
        ]);
    });

    test('an inner ifThen can be nested inside the callback', () => {
        const steps: string[] = [];

        ifThen(
            () => {
                steps.push('outer-condition');
                return true;
            },
            ({ condition }) => {
                steps.push('outer-callback');
                ifThen(
                    () => {
                        steps.push('inner-condition');
                        return false;
                    },
                    () => {
                        steps.push('inner-callback');
                    }
                );
                steps.push(`recheck:${condition({ callback: () => undefined })}`);
            }
        );

        // The inner condition is falsy, so its callback never runs; the re-check re-runs the outer condition
        expect(steps).toStrictEqual([
            'outer-condition',
            'outer-callback',
            'inner-condition',
            'outer-condition',
            'recheck:true',
        ]);
    });

    test('a condition that receives no arguments can call the injected callback itself', () => {
        const steps: string[] = [];

        ifThen(
            ({ callback }) => {
                steps.push('condition');
                // The condition fully controls whether/when the callback executes
                callback({ condition: () => false });
                return false;
            },
            () => {
                steps.push('callback');
            }
        );

        expect(steps).toStrictEqual(['condition', 'callback']);
    });

    test('errors thrown by the condition propagate', () => {
        expect(() =>
            ifThen(
                () => {
                    throw new TypeError('boom');
                },
                () => 'ran'
            )
        ).toThrow(TypeError);

        expect(() =>
            ifThen(
                () => true,
                () => {
                    throw new RangeError('inner');
                }
            )
        ).toThrow(RangeError);
    });

    test('missing functions throw a TypeError', () => {
        // The condition is truthy, so ifThen tries to call an undefined callback
        expect(() => (ifThen as any)(() => true)).toThrow(TypeError);
        expect(() => (ifThen as any)(undefined, () => 'x')).toThrow(TypeError);
        // A falsy condition never reaches the callback lookup
        expect((ifThen as any)(() => false, undefined)).toBeUndefined();
    });
});
