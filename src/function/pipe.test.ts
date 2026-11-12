import { functionPipe } from '@presource/core';

/**
 * Contract under test: `functionPipe(...fns)` (src/function/pipe.ts).
 *
 * The first step is invoked with `(value, ...args)` and the remaining steps fold over
 * the accumulator with only that value, so `pipe(f, g)(v, ...args)` calls `f(v, ...args)`
 * then `g(resultOfF)`. With no functions the seed is returned unchanged (identity). A
 * throw in any step propagates and skips every downstream step. The fold is a plain
 * loop (step 0 hoisted out of the reduction), and the pipe is synchronous: no step is
 * ever `await`ed (pinned in the last group of tests).
 */
describe('Function piping test', () => {
    test('it should be able to pipe values down', () => {
        const multipleByPi = (value: any) => value * Math.PI;
        const divideBy180 = (value: any) => value / 180;

        const sine = functionPipe(multipleByPi, divideBy180, Math.sin);

        expect(sine(90)).toBe(1);
    });

    test('returns the seed value when no functions are piped', () => {
        const identity = functionPipe();

        expect(identity(5)).toBe(5);
        expect(identity('text')).toBe('text');
        // The seed is returned verbatim, including the implicit undefined
        expect(identity()).toBeUndefined();
        // Objects are passed through by reference
        const source = { a: 1 };
        expect(identity(source)).toBe(source);
    });

    test('pipes through a single function', () => {
        const double = functionPipe((value: number) => value * 2);

        expect(double(21)).toBe(42);
        // Extra arguments are forwarded to the first (and only) step
        expect(double(2, 5)).toBe(4);
    });

    test('pipes through many functions in order', () => {
        const pipeline = functionPipe(
            (value: number) => value + 1,
            (value: number) => value * 2,
            (value: number) => value - 3,
            (value: number) => `${value}%`
        );

        expect(pipeline(9)).toBe('17%');
    });

    test('forwards extra call arguments only to the first function', () => {
        const seen: any[][] = [];
        const first = (...args: any[]) => {
            seen.push(args);
            return 'mid';
        };
        const second = (...args: any[]) => {
            seen.push(args);
            return 'end';
        };

        expect(functionPipe(first, second)('x', 'y')).toBe('end');
        // Step 0 gets (value, ...args); downstream steps get only the accumulator
        expect(seen).toStrictEqual([['x', 'y'], ['mid']]);
    });

    test('all extra arguments reach the first step only', () => {
        const sum = functionPipe((value: number, a: number, b: number) => value + a + b, (value: number) => value * 2);

        expect(sum(1, 2, 3)).toBe(12);
    });

    test('undefined intermediate results propagate exactly', () => {
        const observed: string[] = [];
        const result = functionPipe(
            () => undefined,
            (value: any) => {
                observed.push(`${value}|${typeof value}`);
                return value;
            },
            (value: any) => `${String(value)}!`
        )(1);

        expect(observed).toStrictEqual(['undefined|undefined']);
        expect(result).toBe('undefined!');
    });

    test('a throwing step aborts every downstream step', () => {
        const first = vi.fn((value: number) => value + 1);
        const second = vi.fn((value: number) => {
            throw new Error(`boom:${value}`);
        });
        const third = vi.fn((value: number) => value);

        const pipeline = functionPipe(first, second, third);

        expect(() => pipeline(1)).toThrow('boom:2');
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(third).toHaveBeenCalledTimes(0);
        expect(first).toHaveBeenCalledWith(1);
        expect(second).toHaveBeenCalledWith(2);
    });

    test('the same pipe can be reused and each run is independent', () => {
        const pipeline = functionPipe((value: number) => value * 3, (value: number) => value + 1);

        expect(pipeline(1)).toBe(4);
        expect(pipeline(2)).toBe(7);
        expect(pipeline(1, 'ignored' as any)).toBe(4);
    });

    test('returns a reusable function', () => {
        const pipeline = functionPipe((value: string) => value.toUpperCase());

        expect(typeof pipeline).toBe('function');
        expect(pipeline('abc')).toBe('ABC');
        expect(pipeline('def')).toBe('DEF');
    });

    // ------------------------------------------------------------------
    // G15 PINNED CONTRACT — `functionPipe` is synchronous by contract: no step is ever
    // `await`ed, so an async step hands its Promise object to the next function (and to
    // the caller, if it is the last step). src/function/pipe.ts has no async path at all.
    // ------------------------------------------------------------------
    test('an async step hands the raw Promise to the next step', async () => {
        const observed: unknown[] = [];
        const first = async () => 1;
        const second = (value: any) => {
            observed.push(value);
            // The downstream step sees a Promise, not the resolved value
            return Object.prototype.toString.call(value);
        };

        const result = functionPipe(first, second)(0);

        expect(observed).toHaveLength(1);
        const [handed] = observed;
        expect(handed).toBeInstanceOf(Promise);
        expect(result).toBe('[object Promise]');
        // Nothing was awaited: the promise is still unsettled at this point and only
        // later settles with the async step's own value.
        await expect(handed).resolves.toBe(1);
    });

    test('the Promise is forwarded by identity and is never re-wrapped', async () => {
        let created: Promise<number> | undefined;
        const asyncStep = () => {
            created = Promise.resolve(42);
            return created;
        };
        const passThrough = (value: any) => value;

        const result = functionPipe(asyncStep, passThrough)(0);

        // The very same Promise instance reaches the caller — no `async` wrapper, no unwrap
        expect(result).toBe(created);
        expect(await result).toBe(42);
    });

    test('a trailing async step makes the pipe return a pending Promise', () => {
        const pending = functionPipe(
            (value: number) => value + 1,
            async (value: number) => value
        )(1);

        // Returned synchronously as an unsettled Promise (the pipe itself never awaits)
        expect(pending).toBeInstanceOf(Promise);
        // A single-function pipe behaves the same way
        expect(functionPipe(async () => 7)()).toBeInstanceOf(Promise);
    });

    test('a synchronous pipe never returns a Promise', () => {
        const result = functionPipe((value: number) => value * 2, (value: number) => `${value}!`)(3);

        expect(result).toBe('6!');
        expect(result).not.toBeInstanceOf(Promise);
    });
});
