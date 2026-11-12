import { functionDelay } from '@presource/core';

/**
 * Contract under test: `functionDelay(callback, delay = 0)` (src/function/delay.ts).
 *
 * It is a thin `setTimeout` wrapper: the callback receives exactly one argument,
 * `{ delay }`, whose `delay(time)` helper schedules ANOTHER independent timer
 * (there is no cancel API — see the TODO on delay.ts:16). The callback's return
 * value is discarded, and the value returned by `functionDelay` itself is the raw
 * timer handle.
 */
describe('Delaying Function', () => {
    // Using Jest fake timer
    vi.useFakeTimers();

    afterEach(() => {
        // Every test schedules timers; clear them so pending work cannot leak
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    beforeEach(() => {
        // Fresh clock per test keeps the advance counts below exact
        vi.useFakeTimers();
    });

    test('Function Delayed Correctly', () => {
        expect.assertions(1);
        // Trigger Once
        functionDelay(() => {
            expect(true).toBe(true);
        });
        vi.runOnlyPendingTimers();
    });

    test('does not fire before the delay elapses', () => {
        const spy = vi.fn();
        functionDelay(spy, 500);

        expect(spy).toHaveBeenCalledTimes(0);

        // One millisecond short of the deadline
        vi.advanceTimersByTime(499);
        expect(spy).toHaveBeenCalledTimes(0);

        vi.advanceTimersByTime(1);
        expect(spy).toHaveBeenCalledTimes(1);

        // The timer is one-shot: further time does not re-fire it
        vi.advanceTimersByTime(5000);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('passes the reschedule helper as the only argument', () => {
        const payloads: any[] = [];
        functionDelay((data) => payloads.push(data), 100);

        expect(payloads).toStrictEqual([]);

        vi.advanceTimersByTime(100);

        // Exactly one invocation with exactly one `{ delay }` argument object
        expect(payloads).toHaveLength(1);
        expect(Object.keys(payloads[0])).toStrictEqual(['delay']);
        expect(typeof payloads[0].delay).toBe('function');
        expect(payloads[0].delay.length).toBe(1);
    });

    test('the reschedule helper only fires again after advancing time', () => {
        const order: string[] = [];
        functionDelay(({ delay }) => {
            order.push('first');
            delay(100);
        }, 100);

        vi.advanceTimersByTime(100);
        expect(order).toStrictEqual(['first']);

        vi.advanceTimersByTime(99);
        expect(order).toStrictEqual(['first']);

        vi.advanceTimersByTime(1);
        expect(order).toStrictEqual(['first', 'first']);
    });

    test('defaults to a zero delay when no time is given', () => {
        const spy = vi.fn();
        functionDelay(spy);

        // setTimeout(fn, 0) still needs a tick before the callback runs
        expect(spy).toHaveBeenCalledTimes(0);
        vi.advanceTimersByTime(0);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('a zero delay argument behaves like the default', () => {
        const spy = vi.fn();
        functionDelay(spy, 0);

        vi.runOnlyPendingTimers();
        expect(spy).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1000);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('recursive delay stops when the callback stops rescheduling', () => {
        const countdown: number[] = [];
        let remaining = 3;

        functionDelay(({ delay }) => {
            countdown.push(remaining);
            if (--remaining > 0) delay(10);
        }, 10);

        // 3 runs need 3 deadlines of 10ms each
        vi.advanceTimersByTime(10);
        expect(countdown).toStrictEqual([3]);
        vi.advanceTimersByTime(10);
        expect(countdown).toStrictEqual([3, 2]);
        vi.advanceTimersByTime(10);
        expect(countdown).toStrictEqual([3, 2, 1]);

        vi.advanceTimersByTime(1000);
        expect(countdown).toStrictEqual([3, 2, 1]);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('multiple independent delays fire in deadline order', () => {
        const order: string[] = [];
        functionDelay(() => order.push('late'), 300);
        functionDelay(() => order.push('early'), 100);
        functionDelay(() => order.push('middle'), 200);

        vi.advanceTimersByTime(150);
        expect(order).toStrictEqual(['early']);
        vi.advanceTimersByTime(100);
        expect(order).toStrictEqual(['early', 'middle']);
        vi.advanceTimersByTime(100);
        expect(order).toStrictEqual(['early', 'middle', 'late']);
    });

    test('rescheduling from several runs keeps every generated timer', () => {
        let count = 0;
        functionDelay(({ delay }) => {
            count++;
            if (count < 4) delay(5);
        }, 5);

        // Each generated timer is due one step later, so one advance per generation
        vi.advanceTimersByTime(5);
        expect(count).toBe(1);

        vi.advanceTimersByTime(5);
        expect(count).toBe(2);

        vi.advanceTimersByTime(5);
        expect(count).toBe(3);

        vi.advanceTimersByTime(5);
        expect(count).toBe(4);

        // Nothing rescheduled after the 4th run
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(100);
        expect(count).toBe(4);
    });

    test('the callback return value is not surfaced to the caller', () => {
        const spy = vi.fn(() => 'callback-value');
        const handle = functionDelay(spy, 10);

        // The handle is the setTimeout id, not the callback result
        expect(handle).not.toBe('callback-value');

        vi.advanceTimersByTime(10);

        // The callback's value is only observable on the spy itself
        expect(spy.mock.results[0].value).toBe('callback-value');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    test('recursive delay callback schedules next timer', () => {
        let delayFn: ((time: number) => void) | undefined;
        functionDelay(({ delay }) => {
            delayFn = delay;
        }, 0);

        vi.runOnlyPendingTimers();
        expect(typeof delayFn).toBe('function');

        delayFn!(100);
        vi.advanceTimersByTime(100);
    });

    test('delay with custom delay time', () => {
        expect.assertions(1);
        functionDelay(() => {
            expect(true).toBe(true);
        }, 500);
        vi.advanceTimersByTime(500);
    });

    test('multiple delays with limited recursion', () => {
        const calls: number[] = [];
        let count = 0;
        let delayRef: ((time: number) => void) | undefined;

        functionDelay(({ delay }) => {
            delayRef = delay;
            calls.push(++count);
        }, 0);

        vi.runOnlyPendingTimers();
        expect(calls).toStrictEqual([1]);

        delayRef!(10);
        vi.runOnlyPendingTimers();
        expect(calls).toStrictEqual([1, 2]);
    });
});
