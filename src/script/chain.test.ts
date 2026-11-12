import { scriptChain } from '@presource/core';

describe('Callback relay', () => {
    test('Basic relay usage', async () => {
        const result: any[] = [];

        // Creating Relay with the following functions
        const relay = scriptChain({
            apple: () => result.push('apple'),
            banana: () => result.push('banana'),
            cat: () => result.push('cat'),
            dog: () => result.push('dog')
        });

        await relay.apple();
        expect(result).toStrictEqual(['apple']);

        // Triggering another
        await relay.banana();
        expect(result).toStrictEqual(['apple', 'banana']);

        // Triggering multiple in chain
        await relay.cat().dog();
        expect(result).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
    });

    test('Basic relay usage 2 - with arguments', async () => {
        const result: any[] = [];
        const relay = scriptChain({
            add: ({ args }) => {
                const [value] = args;
                result.push(value);
            }
        });

        // Can also pass in arguments
        await relay.add(1).add(2).add(3);
        expect(result).toStrictEqual([1, 2, 3]);
    });

    test('script called directly returns null', () => {
        const relay = scriptChain({
            test: () => {}
        });

        const result = (relay as any)();
        expect(result).toBeNull();
    });

    test('relay resolves when queue is empty', async () => {
        const result: string[] = [];
        const relay = scriptChain({
            step: () => {
                result.push('step');
            }
        });

        const runRelay = relay.step();

        // The accessor returned by `scriptChain` is a plain function, NOT the run
        // relay (src/script/chain.ts:61-63, 99-101), so awaiting it does not wait
        // for the queue to drain.
        expect(await relay).toBe(relay);
        expect(result).toStrictEqual([]);

        // The object returned by the trigger is the real drain signal
        await runRelay;
        expect(result).toStrictEqual(['step']);
    });

    // CONTRACT: every key of the input map becomes a callable method on the
    // returned accessor, and the accessor itself is a plain function whose direct
    // call is a no-op returning null (src/script/chain.ts:61-63, 99-101).
    test('Every key becomes a relay method on the returned accessor', () => {
        const relay = scriptChain({
            apple: () => {},
            banana: () => {},
            cat: () => {}
        });

        expect(typeof relay).toBe('function');
        expect(Object.keys(relay)).toStrictEqual(['apple', 'banana', 'cat']);
        expect(typeof relay.apple).toBe('function');
        expect(typeof relay.banana).toBe('function');
        expect(typeof relay.cat).toBe('function');
        // Nothing has been invoked yet, so the direct call is still the null stub
        expect((relay as any)()).toBeNull();
    });

    // CONTRACT: invoking a trigger does NOT run the callback synchronously — it
    // enqueues into the internal `functionQueue` (deferred by one timer) and hands
    // back the lazily generated relay (src/script/chain.ts:68-79).
    test('Trigger enqueues instead of running inline and returns the run relay', async () => {
        const result: string[] = [];
        const relay = scriptChain({
            apple: () => {
                result.push('apple');
            },
            banana: () => {
                result.push('banana');
            }
        });

        const runRelay = relay.apple();
        // Still queued: the callback has not run yet
        expect(result).toStrictEqual([]);
        // The trigger returns a thenable carrying every callback key
        expect(typeof runRelay.then).toBe('function');
        expect(Object.keys(runRelay)).toStrictEqual(['apple', 'banana']);

        // A second trigger in the same run returns the very same relay object
        const sameRelay = relay.banana();
        expect(sameRelay).toBe(runRelay);

        await runRelay;
        // FIFO order inside one run, matching invocation order
        expect(result).toStrictEqual(['apple', 'banana']);
    });

    // CONTRACT: the relay is regenerated for the next run — after the queue drains
    // the internal relay/queue are cleared, so the next trigger builds fresh ones
    // (src/script/chain.ts:82-97).
    test('Relay is regenerated after the queue drains', async () => {
        const result: string[] = [];
        const relay = scriptChain({
            push: ({ args }) => {
                result.push(args[0]);
            }
        });

        const firstRun = relay.push('a');
        await firstRun;
        expect(result).toStrictEqual(['a']);

        const secondRun = relay.push('b');
        // A brand new relay object, not the drained one
        expect(secondRun).not.toBe(firstRun);
        await secondRun;
        expect(result).toStrictEqual(['a', 'b']);

        // The accessor itself is stable across runs and still returns null
        expect((relay as any)()).toBeNull();
        const thirdRun = relay.push('c');
        expect(thirdRun).not.toBe(secondRun);
        await thirdRun;
        expect(result).toStrictEqual(['a', 'b', 'c']);
    });

    // CONTRACT: the callback payload is exactly `{ script, args }`, where `script`
    // is the accessor object returned by `scriptChain` and `args` is the verbatim
    // argument list of the trigger call (src/script/chain.ts:72-75).
    test('Callback payload is exactly { script, args }', async () => {
        const payloads: { keys: string[]; args: unknown[]; isAccessor: boolean; returnType: string }[] = [];

        const relay: any = scriptChain({
            one: (params: any) => {
                payloads.push({
                    keys: Object.keys(params),
                    args: params.args,
                    isAccessor: params.script === relay,
                    returnType: typeof params.script
                });
                return 'ignored-return-value';
            },
            two: (params: any) => {
                payloads.push({
                    keys: Object.keys(params),
                    args: params.args,
                    isAccessor: params.script === relay,
                    returnType: typeof params.script.two
                });
            }
        });

        await relay.one(1, 'x', null);
        await relay.two();

        expect(payloads).toStrictEqual([
            { keys: ['script', 'args'], args: [1, 'x', null], isAccessor: true, returnType: 'function' },
            { keys: ['script', 'args'], args: [], isAccessor: true, returnType: 'function' }
        ]);
    });

    // CONTRACT: execution follows invocation order (not definition order), and an
    // async callback is fully awaited before the next queued one starts.
    test('Runs in invocation order and awaits async callbacks sequentially', async () => {
        const events: string[] = [];

        const relay = scriptChain({
            first: async () => {
                events.push('first:start');
                await new Promise<void>((resolve) => setTimeout(resolve, 10));
                events.push('first:end');
            },
            second: () => {
                events.push('second');
            },
            third: () => {
                events.push('third');
            }
        });

        // Chained on one relay: enqueue order is second -> first -> third
        await relay.second().first().third();

        expect(events).toStrictEqual(['second', 'first:start', 'first:end', 'third']);
    });

    // CONTRACT: two different keys can drive one run, and the callback return
    // value is discarded — the relay resolves with undefined.
    test('Two different keys in one run resolve the relay with undefined', async () => {
        const calls: string[] = [];

        const relay = scriptChain({
            alpha: ({ args }: any) => {
                calls.push(`alpha:${args[0]}`);
                return 'alpha-value';
            },
            beta: ({ args }: any) => {
                calls.push(`beta:${args[0]}`);
                return 'beta-value';
            }
        });

        const settledValue = await relay.alpha(1).beta(2);

        expect(calls).toStrictEqual(['alpha:1', 'beta:2']);
        expect(settledValue).toBeUndefined();
    });
});

/**
 * G2 — async failure contract of the relay.
 *
 * Before the fix, a callback whose promise rejected killed the backing
 * `functionQueue` (its promise chain had no rejection handler), so `complete`
 * never ran and the relay stayed pending forever: awaiting it hung (verified
 * >400 ms), and so did every later run. The relay now always settles, and it
 * reports the run's outcome instead of hiding it.
 *
 * Every case races the relay against a fake-timer deadline and advances the
 * clock concurrently, so a regression that never settles fails with 'timeout'
 * instead of hanging the runner.
 */
describe('Callback relay - async failure contracts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    /** Exact, comparable description of how a relay settled. */
    const settleAs = (relay: Promise<any>): Promise<string> =>
        relay.then(
            (value: unknown) => `resolved:${String(value)}`,
            (error: any) => `rejected:${error instanceof Error ? error.message : String(error)}`
        );

    /** Fake-timer watchdog: resolves 'timeout' if the relay never settles. */
    const deadline = (ms: number) =>
        new Promise<string>((resolve) => {
            setTimeout(() => resolve('timeout'), ms);
        });

    /** Settle `relay` while advancing the fake clock; 'timeout' means it hung. */
    const settleWithin = async (relay: Promise<any>, ms = 200): Promise<string> => {
        const [outcome] = await Promise.all([
            Promise.race([settleAs(relay), deadline(ms)]),
            vi.advanceTimersByTimeAsync(ms),
        ]);
        return outcome;
    };

    test('relay rejects with the original error when a callback rejects', async () => {
        const events: string[] = [];
        const failure = new Error('chain-boom');
        const relay: any = scriptChain({
            fail: async () => {
                throw failure;
            },
            later: () => {
                events.push('later');
            }
        });

        const run = relay.fail().later();

        expect(await settleWithin(run)).toBe('rejected:chain-boom');
        // The run keeps draining: the callback queued behind the failure still ran
        expect(events).toStrictEqual(['later']);
    });

    test('relay rejects with a synchronous throw from a callback', async () => {
        // The queue item is an async wrapper, so a sync throw becomes a rejection
        const relay: any = scriptChain({
            boom: () => {
                throw new Error('sync-boom');
            }
        });

        expect(await settleWithin(relay.boom())).toBe('rejected:sync-boom');
    });

    test('a non-Error rejection reason reaches the relay unchanged', async () => {
        const relay: any = scriptChain({
            fail: () => Promise.reject('string-reason')
        });

        expect(await settleWithin(relay.fail())).toBe('rejected:string-reason');
    });

    test('several failing callbacks reject with the FIRST error but all still run', async () => {
        const events: string[] = [];
        const relay: any = scriptChain({
            one: async () => {
                events.push('one');
                throw new Error('first');
            },
            two: () => {
                events.push('two');
                return Promise.reject(new Error('second'));
            }
        });

        expect(await settleWithin(relay.one().two())).toBe('rejected:first');
        expect(events).toStrictEqual(['one', 'two']);
    });

    test('later runs still settle after a run whose callback rejected', async () => {
        const events: string[] = [];
        const relay: any = scriptChain({
            fail: async () => {
                throw new Error('first-boom');
            },
            ok: () => {
                events.push('ok');
            }
        });

        const firstRun = relay.fail();
        expect(await settleWithin(firstRun)).toBe('rejected:first-boom');

        // The drained run cleared its relay, so this is a brand new instance —
        // and it no longer inherits the hang the old implementation produced
        const secondRun = relay.ok();
        expect(secondRun).not.toBe(firstRun);
        expect(await settleWithin(secondRun)).toBe('resolved:undefined');
        expect(events).toStrictEqual(['ok']);

        expect(await settleWithin(relay.ok())).toBe('resolved:undefined');
        expect(events).toStrictEqual(['ok', 'ok']);
    });

    test('a callback rejecting with `undefined` rejects the relay with reason `undefined`', async () => {
        // `functionQueue` reports a failure through the PRESENCE of the `error` key of the
        // `execute` payload (src/function/queue.ts:19-22, 127-131), so a reason of `undefined`
        // is still a failure and the relay must reject with it. The old value check
        // (`payload.error !== undefined`) could not see this reason and resolved the run,
        // contradicting the JSDoc in src/script/chain.ts:59-62.
        const relay: any = scriptChain({
            fail: () => Promise.reject(undefined)
        });

        // `settleAs` stringifies a non-Error reason, so reason `undefined` reads as 'undefined'
        expect(await settleWithin(relay.fail())).toBe('rejected:undefined');
    });
});
