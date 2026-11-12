import { loopUntil } from '@presource/core';

describe('Until Loop (Basic)', () => {
    // Basic While Looping
    test('Should loop until value = 5', () => {
        let value = 0;
        const targetedValue = 5;

        // Running Condition Check
        const condition = () => value === targetedValue;
        // Continously Incrementing until Condition is Meet.
        // Not that undefined will trigger break loop
        loopUntil(condition, () => {
            value++;
        });
        // Expecting Value to be Targted Value
        expect(value).toBe(targetedValue);
    });

    test('Should break when callback returns a non-undefined value', () => {
        let count = 0;
        loopUntil(() => count === 100, () => {
            count++;
            if (count === 3) return 'break';
        });
        expect(count).toBe(3);
    });

    // CONTRACT: `loopUntil` has NO return statement (src/loop/until.ts:59-75 —
    // the break exits without a value), unlike `loopWhile` which returns
    // `params.result`. Even a callback that breaks with a value yields undefined.
    test('Always returns undefined, including when the callback breaks with a value', () => {
        let passes = 0;

        const result = loopUntil(
            () => passes === 100,
            () => {
                passes++;
                if (passes === 3) return 'halt';
                return undefined;
            },
        );

        expect(passes).toBe(3);
        expect(result).toBeUndefined();
        expect(typeof result).toBe('undefined');
    });

    // CONTRACT (verified against src/loop/until.ts:67): the condition is checked
    // in the `while` header BEFORE the first pass, so an already-true condition
    // runs the body ZERO times. The JSDoc at src/loop/until.ts:50-52 claims the
    // body "runs at least once" — the implementation contradicts that.
    test('True up-front condition runs the body zero times (do-until JSDoc is wrong)', () => {
        const runs: string[] = [];
        let conditionCalls = 0;

        const result = loopUntil(
            () => {
                conditionCalls++;
                return true;
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
    // params record. Key order matches the object literal at src/loop/until.ts:60-65.
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
                result: params.result,
                count: params.count,
            });
            shared.push(params);
            return passes === 2;
        };

        const callback = (params: any) => {
            if (firstParams === null) firstParams = params;
            callbackSnaps.push({
                keys: Object.keys(params),
                callback: params.callback === callback,
                sameRecord: params === firstParams,
                result: params.result,
                count: params.count,
            });
            shared.push(params);
            passes++;
            return undefined;
        };

        loopUntil(condition, callback);

        expect(passes).toBe(2);
        // `condition` is evaluated three times: before pass 1, before pass 2, and the stop check
        expect(conditionSnaps).toStrictEqual([
            { keys: ['condition', 'callback', 'result', 'count'], condition: true, result: undefined, count: 0 },
            { keys: ['condition', 'callback', 'result', 'count'], condition: true, result: undefined, count: 1 },
            { keys: ['condition', 'callback', 'result', 'count'], condition: true, result: undefined, count: 2 },
        ]);
        expect(callbackSnaps).toStrictEqual([
            { keys: ['condition', 'callback', 'result', 'count'], callback: true, sameRecord: true, result: undefined, count: 0 },
            { keys: ['condition', 'callback', 'result', 'count'], callback: true, sameRecord: true, result: undefined, count: 1 },
        ]);
        // One single record object for every condition AND callback invocation
        expect(shared.length).toBe(5);
        expect(shared.every((params) => params === firstParams)).toBe(true);
    });

    // CONTRACT: the body break short-circuits the condition, so the condition is
    // called once per pass instead of once-per-pass-plus-the-final-stop-check.
    test('Callback break short-circuits the condition check', () => {
        let conditionCalls = 0;
        let passes = 0;

        loopUntil(
            () => {
                conditionCalls++;
                return passes === 100;
            },
            () => {
                passes++;
                if (passes === 2) return 'stop';
                return undefined;
            },
        );

        expect(passes).toBe(2);
        // Checked before pass 1 and before pass 2 only — the break skips the third check
        expect(conditionCalls).toBe(2);
    });

    // CONTRACT: `count` increments only when the body does NOT break, and
    // `result` only ever stores the `undefined` that allowed the loop to continue.
    test('Counters advance only for passes that do not break', () => {
        const observed: Record<string, unknown>[] = [];
        let passes = 0;

        loopUntil(
            () => passes === 100,
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
    });

    // Any defined value — including the falsy ones — is the break signal.
    test.each([0, false, '', null] as const)('Falsy-but-defined return %p stops the loop', (haltValue) => {
        let passes = 0;
        let conditionCalls = 0;

        loopUntil(
            () => {
                conditionCalls++;
                return passes === 100;
            },
            () => {
                passes++;
                if (passes === 2) return haltValue;
                return undefined;
            },
        );

        expect(passes).toBe(2);
        expect(conditionCalls).toBe(2);
    });
});
