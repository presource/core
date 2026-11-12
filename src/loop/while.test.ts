import { loopWhile } from '@presource/core';

describe('While Loop (Basic)', () => {
    // Basic While Looping
    test('Should loop until value = 5', () => {
        let value = 0;
        const targetedValue = 5;

        // Running Condition Check
        const condition = () => value < targetedValue;
        // Continously Incrementing until Condition is Meet.
        // Not that undefined will trigger break loop
        loopWhile(condition, () => {
            value++;
        });
        // Expecting Value to be Targted Value
        expect(value).toBe(targetedValue);
    });

    test('Should break when callback returns a non-undefined value', () => {
        let count = 0;
        const result = loopWhile(() => count < 100, () => {
            count++;
            if (count === 3) return 'break';
        });
        expect(count).toBe(3);
        expect(result).toBe(undefined);
    });

    // CONTRACT (the subtle one): `loopWhile` returns `params.result`, and the
    // `break` at src/loop/while.ts:67 happens BEFORE `params.result = result` on
    // line 70. So the break value is never stored and never returned — on the
    // very first pass the returned value is still the initial `undefined`.
    test('Breaking on the first pass returns undefined, not the break value', () => {
        let passes = 0;

        const result = loopWhile(
            () => passes < 100,
            () => {
                passes++;
                return 'halted';
            },
        );

        expect(passes).toBe(1);
        expect(result).toBeUndefined();
    });

    // CONTRACT: the returned value is the PREVIOUS pass' result, never the break
    // value. Only `undefined` can ever be stored (a defined value breaks), so
    // `loopWhile` always returns undefined in practice.
    test('Breaking on a later pass returns the previous result (always undefined)', () => {
        const observed: Record<string, unknown>[] = [];
        let passes = 0;

        const result = loopWhile(
            () => passes < 100,
            (params) => {
                observed.push({ count: params.count, result: params.result });
                passes++;
                if (passes === 3) return 'halt';
                return undefined;
            },
        );

        expect(passes).toBe(3);
        expect(observed).toStrictEqual([
            { count: 0, result: undefined },
            { count: 1, result: undefined },
            { count: 2, result: undefined },
        ]);
        expect(result).toBeUndefined();
    });

    // CONTRACT: the condition gates the very first pass, so a false condition
    // means zero body runs and an undefined result.
    test('False up-front condition never runs the body and returns undefined', () => {
        const runs: string[] = [];
        let conditionCalls = 0;

        const result = loopWhile(
            () => {
                conditionCalls++;
                return false;
            },
            () => {
                runs.push('body');
            },
        );

        expect(conditionCalls).toBe(1);
        expect(runs).toStrictEqual([]);
        expect(result).toBeUndefined();
    });

    // CONTRACT: both the condition and the callback receive the SAME mutable
    // params record. Key order matches the object literal at src/loop/while.ts:57-62
    // (note it differs from loopUntil's insertion order).
    test('Condition and callback share one params record with the exact key set', () => {
        const conditionSnaps: Record<string, unknown>[] = [];
        const callbackSnaps: Record<string, unknown>[] = [];
        const shared: unknown[] = [];
        let firstParams: unknown = null;
        let passes = 0;

        const condition = (params: any) => {
            conditionSnaps.push({
                keys: Object.keys(params),
                condition: params.condition === condition,
                count: params.count,
                result: params.result,
            });
            shared.push(params);
            return passes < 2;
        };

        const callback = (params: any) => {
            if (firstParams === null) firstParams = params;
            callbackSnaps.push({
                keys: Object.keys(params),
                callback: params.callback === callback,
                sameRecord: params === firstParams,
                count: params.count,
                result: params.result,
            });
            shared.push(params);
            passes++;
            return undefined;
        };

        const result = loopWhile(condition, callback);

        expect(passes).toBe(2);
        expect(conditionSnaps).toStrictEqual([
            { keys: ['condition', 'callback', 'count', 'result'], condition: true, count: 0, result: undefined },
            { keys: ['condition', 'callback', 'count', 'result'], condition: true, count: 1, result: undefined },
            { keys: ['condition', 'callback', 'count', 'result'], condition: true, count: 2, result: undefined },
        ]);
        expect(callbackSnaps).toStrictEqual([
            { keys: ['condition', 'callback', 'count', 'result'], callback: true, sameRecord: true, count: 0, result: undefined },
            { keys: ['condition', 'callback', 'count', 'result'], callback: true, sameRecord: true, count: 1, result: undefined },
        ]);
        expect(shared.length).toBe(5);
        expect(shared.every((params) => params === firstParams)).toBe(true);
        expect(result).toBeUndefined();
    });

    // CONTRACT: condition-driven stop runs the check once more than the body;
    // the body-break short-circuits that final check.
    test('Condition check count is passes + 1 on a condition stop and equal on a break', () => {
        let conditionCalls = 0;
        let passes = 0;

        loopWhile(
            () => {
                conditionCalls++;
                return passes < 2;
            },
            () => {
                passes++;
            },
        );

        expect(passes).toBe(2);
        expect(conditionCalls).toBe(3);

        conditionCalls = 0;
        passes = 0;

        loopWhile(
            () => {
                conditionCalls++;
                return passes < 100;
            },
            () => {
                passes++;
                if (passes === 2) return 'stop';
            },
        );

        expect(passes).toBe(2);
        expect(conditionCalls).toBe(2);
    });

    // Any defined value — including the falsy ones — breaks the loop, and none
    // of them ever reaches the return value (see the break-before-store contract).
    test.each([0, false, '', null] as const)('Falsy-but-defined return %p stops the loop and is not returned', (haltValue) => {
        let passes = 0;
        let conditionCalls = 0;

        const result = loopWhile(
            () => {
                conditionCalls++;
                return passes < 100;
            },
            () => {
                passes++;
                if (passes === 2) return haltValue;
            },
        );

        expect(passes).toBe(2);
        expect(conditionCalls).toBe(2);
        expect(result).toBeUndefined();
    });
});
