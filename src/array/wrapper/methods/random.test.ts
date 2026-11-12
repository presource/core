import { arrayWrapper } from '..';
import { afterEach, describe, expect, test, vi } from 'vitest';

/**
 * `random` contract (src/array/wrapper/methods/random.ts).
 *
 * Determinism: `Math.random()` is stubbed so the index expression
 * `Math.floor(Math.random() * element.length)` (random.ts:26) maps to an exact
 * element. Regression focus: a leftover `console.log('what is instance:', ...)`
 * debug statement was removed, so `random()` must emit no console output.
 */
describe('how to use random ', () => {
    const $array = arrayWrapper();
    const sample = ['apple', 'banana', 'cat', 'dog'];
    // 12 elements: floor() boundaries are checked against exact index math
    const twelve = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    afterEach(() => {
        // Restore Math.random / console spies so stubs never leak between tests
        vi.restoreAllMocks();
    });

    test('stubbed Math.random of 0 returns the first element', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect($array(sample).random()).toBe('apple');
        expect($array(twelve).random()).toBe(0);
        expect($array(['only']).random()).toBe('only');
    });

    test('stubbed Math.random near 1 returns the last element', () => {
        // floor(0.999 * 4) === 3 and floor(0.999 * 12) === 11
        vi.spyOn(Math, 'random').mockReturnValue(0.999);
        expect($array(sample).random()).toBe('dog');
        expect($array(twelve).random()).toBe(11);
        expect($array(['only']).random()).toBe('only');
    });

    test('stubbed Math.random of 0.5 returns the exact middle element', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        // floor(0.5 * 4) === 2
        expect($array(sample).random()).toBe('cat');
        // floor(0.5 * 12) === 6
        expect($array(twelve).random()).toBe(6);
    });

    test('index boundaries use floor(), not round()', () => {
        // floor(0.25 * 4) === 1 => second element
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
        expect($array(sample).random()).toBe('banana');
        expect(spy).toHaveBeenCalledTimes(1);
        // Just below the 0.25 boundary still lands on index 0
        spy.mockReturnValue(0.2499999);
        expect($array(sample).random()).toBe('apple');
        // 0.2 * 12 === 2.4 => floor is index 2
        spy.mockReturnValue(0.2);
        expect($array(twelve).random()).toBe(2);
        // Exactly one Math.random() draw per random() call (3 draws so far)
        expect(spy).toHaveBeenCalledTimes(3);
    });

    test('empty array yields undefined', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        // length 0 => index 0 => element[0] is absent, callers must null-check
        expect($array([]).random()).toBeUndefined();
    });

    test('does not write anything to the console', () => {
        // REGRESSION: the removed debug line logged every drawn element
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        $array(sample).random();
        // Nullish members used to be logged by the debug statement
        $array(['x', null, undefined]).random();
        $array([]).random();

        expect(log).toHaveBeenCalledTimes(0);
        expect(warn).toHaveBeenCalledTimes(0);
        expect(error).toHaveBeenCalledTimes(0);
        expect(info).toHaveBeenCalledTimes(0);
        expect(debug).toHaveBeenCalledTimes(0);
    });

    test('reads the raw element array, ignoring an active select filter', () => {
        // random.ts:25-26 uses `element` directly (not instance.keys()), so the
        // filter does not narrow the draw. Pinned as the current behaviour.
        vi.spyOn(Math, 'random').mockReturnValue(0.999);
        expect($array(sample).select(0).random()).toBe('dog');
        // index 2 is filtered out, yet it is still reachable
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        expect($array(sample).select([0, 1]).random()).toBe('cat');
    });
});
