import { ifFalse, ifTrue } from './if';

/**
 * Contract source: src/conditions/if.ts (lines 20-40).
 *
 * Behaviour nailed down here:
 * - The branch test is plain truthiness (`if (value)` / `if (!value)`), which is exactly the
 *   `isBooleanTrue(!!value)` / `isBooleanFalse(!!value)` coercion it replaced, so the branch
 *   fires for any truthy / falsy input.
 * - The callback payload is the RAW value inside `{ value }` - it is never coerced.
 * - The default callback (no argument given) returns `true`; a branch that does not run
 *   returns `undefined` regardless of the callback.
 */
describe('If Condition Test', () => {
    test('Condition is true', () => {
        expect(ifTrue(true, () => 'test')).toBe('test');
        expect(ifFalse(true, () => 'test')).toBeUndefined();
    });

    test('Condition is false', () => {
        expect(ifFalse(false, () => 'test')).toBe('test');
        expect(ifTrue(false, () => 'test')).toBeUndefined();
    });

    test('ifTrue with default callback', () => {
        expect(ifTrue(true)).toBe(true);
    });

    test('ifFalse with default callback', () => {
        expect(ifFalse(false)).toBe(true);
    });

    test('ifTrue with falsy values', () => {
        expect(ifTrue(null, () => 'triggered')).toBeUndefined();
        expect(ifTrue(undefined, () => 'triggered')).toBeUndefined();
        expect(ifTrue(0, () => 'triggered')).toBeUndefined();
        expect(ifTrue('', () => 'triggered')).toBeUndefined();
    });

    test('ifFalse with falsy values', () => {
        expect(ifFalse(null, () => 'triggered')).toBe('triggered');
        expect(ifFalse(undefined, () => 'triggered')).toBe('triggered');
        expect(ifFalse(0, () => 'triggered')).toBe('triggered');
        expect(ifFalse('', () => 'triggered')).toBe('triggered');
    });

    test('callback receives value', () => {
        let received: any;
        ifTrue('hello', ({ value }) => {
            received = value;
        });
        expect(received).toBe('hello');

        received = undefined;
        ifFalse(0, ({ value }) => {
            received = value;
        });
        expect(received).toBe(0);
    });

    test('the payload object is exactly { value } and is passed once', () => {
        const callback = vi.fn();

        ifTrue('hello', callback);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ value: 'hello' });

        const falsyCallback = vi.fn();
        ifFalse(0, falsyCallback);

        expect(falsyCallback).toHaveBeenCalledTimes(1);
        expect(falsyCallback).toHaveBeenCalledWith({ value: 0 });
    });

    test('the raw value is reported, not the coerced boolean', () => {
        const truthy = vi.fn();
        ifTrue('42', truthy);
        expect(truthy).toHaveBeenCalledWith({ value: '42' });

        const objects = vi.fn();
        ifTrue({ a: 1 }, objects);
        expect(objects).toHaveBeenCalledWith({ value: { a: 1 } });

        const arrays = vi.fn();
        ifFalse([], arrays);
        expect(arrays).not.toHaveBeenCalled();

        const nan = vi.fn();
        ifFalse(NaN, nan);
        expect(nan).toHaveBeenCalledTimes(1);
        expect(nan).toHaveBeenCalledWith({ value: NaN });
    });

    test('every truthy value fires ifTrue and skips ifFalse', () => {
        const values: any[] = [true, 1, -1, '0', 'false', [], {}, [0], { a: 0 }, () => 0, Symbol('x'), new Date(0)];

        for (const value of values) {
            const truthy = vi.fn(() => 'ran');
            const falsy = vi.fn(() => 'ran');

            expect(ifTrue(value, truthy)).toBe('ran');
            expect(ifFalse(value, falsy)).toBeUndefined();
            expect(truthy).toHaveBeenCalledTimes(1);
            expect(falsy).not.toHaveBeenCalled();
        }
    });

    test('every falsy value fires ifFalse and skips ifTrue', () => {
        const values: any[] = [false, 0, -0, 0n, '', null, undefined, NaN];

        for (const value of values) {
            const truthy = vi.fn(() => 'ran');
            const falsy = vi.fn(() => 'ran');

            expect(ifFalse(value, falsy)).toBe('ran');
            expect(ifTrue(value, truthy)).toBeUndefined();
            expect(falsy).toHaveBeenCalledTimes(1);
            expect(truthy).not.toHaveBeenCalled();
        }
    });

    test('the default callback only runs on the matching branch', () => {
        expect(ifTrue(1)).toBe(true);
        expect(ifTrue(0)).toBeUndefined();
        expect(ifFalse(0)).toBe(true);
        expect(ifFalse(1)).toBeUndefined();
    });

    test('the callback return value is passed through untouched', () => {
        expect(ifTrue('v', ({ value }) => `${value}!`)).toBe('v!');
        expect(ifFalse(undefined, () => ({ obj: 1 }))).toStrictEqual({ obj: 1 });
        // A callback that returns undefined is indistinguishable by return value alone...
        const callback = vi.fn(() => undefined);
        expect(ifTrue(1, callback)).toBeUndefined();
        // ...but the branch really did run
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('the callback of a skipped branch is never invoked', () => {
        const callback = vi.fn(() => 'ran');

        expect(ifTrue(false, callback)).toBeUndefined();
        expect(ifFalse(true, callback)).toBeUndefined();
        expect(callback).not.toHaveBeenCalled();
    });
});
