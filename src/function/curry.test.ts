import { functionCurry } from '@presource/core';

/**
 * Contract under test: `functionCurry(fn)` (src/function/curry.ts).
 *
 * The implementation fires only when `args.length === fn.length`; anything else
 * (partial OR over-applied) returns `curried.bind(null, ...args)`. Consequences:
 * - over-applied calls never fire (the bound accumulator keeps growing)
 * - defaulted parameters shrink `fn.length`, so extra arguments stop the call
 * - rest parameters make `fn.length === 0`, so ANY argument stops the call
 * - `bind(null, ...)` drops the receiver, so the target always runs with `this === undefined`
 */
describe('Testing Curry Function - the ability to construct curry function easily', () => {
    it('should be able to curry functions', () => {
        // Create a Sum function
        const sum = (a: number, b: number, c: number) => a + b + c;
        const currySum = functionCurry(sum);

        expect(currySum(5, 10, 20)).toBe(35);
        expect(currySum(5)(10)(20)).toBe(35);
        expect(currySum(5, 10)(20)).toBe(35);
        expect(currySum(5)(10, 20)).toBe(35);
    });

    it('should still work with different naming convention', () => {
        // let's create an example
        const divideBy = functionCurry((a: number, b: number) => b / a);
        const multiplyBy = functionCurry((a: number, b: number) => a * b);

        const divideByTwo = divideBy(2);
        expect(divideByTwo(10)).toBe(5);

        const mupltiplyByFive = multiplyBy(5);
        expect(mupltiplyByFive(10)).toBe(50);
    });

    it('returns a function for every partial argument count', () => {
        const spy = vi.fn((a: number, b: number, c: number) => a + b + c);
        const curried = functionCurry(spy);

        expect(typeof curried(1)).toBe('function');
        expect(typeof curried(1)(2)).toBe('function');
        expect(spy).toHaveBeenCalledTimes(0);

        expect(curried(1)(2)(3)).toBe(6);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(1, 2, 3);
    });

    it('never fires when the function is over-applied', () => {
        const spy = vi.fn((a: number, b: number, c: number) => a + b + c);
        const curried = functionCurry(spy);

        // 4 !== 3, so the accumulator keeps re-binding instead of calling through
        const once = curried(1, 2, 3, 4);
        expect(typeof once).toBe('function');
        expect(typeof once()).toBe('function');
        expect(typeof once()()).toBe('function');
        expect(spy).toHaveBeenCalledTimes(0);
    });

    it('fires on the exact declared arity only (defaulted parameters)', () => {
        // A defaulted parameter is not counted, so `fn.length` is 1
        const withDefault = (a: number, b = 10) => a + b;
        expect(withDefault.length).toBe(1);

        const curried = functionCurry(withDefault);
        // The declared arity fires immediately, using the default for `b`
        expect(curried(1)).toBe(11);

        // Supplying more arguments than `fn.length` never fires
        const extra = functionCurry(withDefault)(1, 2);
        expect(typeof extra).toBe('function');
        expect(typeof extra()).toBe('function');

        // Chaining onto the already-fired result is a TypeError, not a curried call
        expect(() => (functionCurry(withDefault)(1) as any)(2)).toThrow(TypeError);
    });

    it('treats rest parameters as a zero-arity function', () => {
        const withRest = (...args: number[]) => args.length;
        expect(withRest.length).toBe(0);

        const curried = functionCurry(withRest);
        // Only the bare call matches `fn.length === 0`
        expect(curried()).toBe(0);

        // Any argument stops the call, and re-calling the bound result never catches up
        const one = curried(1);
        expect(typeof one).toBe('function');
        expect(typeof one()).toBe('function');
        expect(typeof one()()).toBe('function');
    });

    it('curries zero argument functions', () => {
        const zero = () => 'zero';
        const curried = functionCurry(zero);

        expect(curried()).toBe('zero');
        expect(typeof curried(1)).toBe('function');
    });

    it('curries one argument functions', () => {
        const identity = (value: string) => value;
        const curried = functionCurry(identity);

        expect(curried('echo')).toBe('echo');
        expect(typeof curried('a', 'b')).toBe('function');
    });

    it('keeps the arity of every function form', () => {
        const arrow = (a: number, b: number) => a + b;
        const declared = function (a: number, b: number, c: number) {
            return a + b + c;
        };
        const holder = {
            method(a: number, b: number, c: number, d: number) {
                return a + b + c + d;
            }
        };

        expect([arrow.length, declared.length, holder.method.length]).toStrictEqual([2, 3, 4]);

        expect(functionCurry(arrow)(1)(2)).toBe(3);
        expect(functionCurry(declared)(1)(2)(3)).toBe(6);
        expect(functionCurry(holder.method)(1)(2)(3)(4)).toBe(10);
    });

    it('drops the receiver because the partial is bound to null', () => {
        const holder = {
            value: 7,
            // Methods and plain functions both run with `this === undefined`
            read(this: any) {
                return this === undefined ? 'undefined-this' : String(this.value);
            },
            add(this: any, a: number, b: number) {
                return `${this === undefined ? 'undefined-this' : String(this.value)}:${a}${b}`;
            }
        };

        // A 0-arity method fires straight through `fn(...args)`, losing the receiver
        expect(functionCurry(holder.read)()).toBe('undefined-this');
        // ...and an explicit call site cannot restore it, bound or direct
        expect(functionCurry(holder.add)(1)(2)).toBe('undefined-this:12');
        expect((functionCurry(holder.add)(1) as any).call({ value: 5 }, 2)).toBe('undefined-this:12');

        // Binding the curried wrapper itself is also ignored once it fires
        expect((functionCurry(holder.read) as any).call({ value: 3 })).toBe('undefined-this');
    });

    it('exposes a zero length curried wrapper', () => {
        const curried = functionCurry((a: number, b: number, c: number) => a + b + c);

        // The wrapper is a rest-arity arrow, so `.length` is 0 regardless of the target
        expect(curried.length).toBe(0);
    });
});
