import { functionChain } from '@presource/core';

/**
 * Contract under test: `functionChain(callback)` (src/function/chain.ts).
 *
 * A single `functionProxy` (src/function/proxy.ts) backs the returned value, so
 * `throughGetQuery`/`currentKey` persist across statements until a call consumes
 * them. Every `.property` read runs the `get` branch (index++, key=prop, and the
 * PREVIOUS pending callback fires); every invocation runs the `call` branch.
 *
 * NOTE: the user callback receives the LIVE `chain` array, so a snapshot copy
 * (`[...data.chain]`) is required to observe per-step state — see the dedicated
 * "live chain reference" test below.
 */
describe('Testing Chain Function - the ability to endlessly chain function calls', () => {
    test('Basic chaining triggers', () => {
        // The list of the callers
        let chainRecord: any = [];
        let paramsRecord: any = [];

        // For Reseting the Chain Records
        const reset = () => {
            chainRecord = [];
            paramsRecord = [];
        };

        // Creating a Chain Function
        const chain = functionChain(({ key, params }) => {
            // If Key is Valid. Add Key to caller List
            if (key) chainRecord.push(key);
            // Adding to Value List
            params.forEach((v) => paramsRecord.push(v));
        });

        // Chain Hi
        chain('hi');

        // Expecting Value List to
        expect(chainRecord).toStrictEqual([]);
        expect(paramsRecord).toStrictEqual(['hi']);

        // Triggering
        reset();
        chain.hello();
        expect(chainRecord).toStrictEqual(['hello']);
        expect(paramsRecord).toStrictEqual([]);

        reset();
        chain.hello.new('chain');
        expect(chainRecord).toStrictEqual(['hello', 'new']);
        expect(paramsRecord).toStrictEqual(['chain']);

        reset();
        chain.hello('world').new('chain');
        expect(chainRecord).toStrictEqual(['hello', 'new']);
        expect(paramsRecord).toStrictEqual(['world', 'chain']);

        reset();
        chain.is.very.very.awesome();
        expect(chainRecord).toStrictEqual(['is', 'very', 'very', 'awesome']);

        reset();
        chain().is().very().very().awesome();

        expect(chainRecord).toStrictEqual(['is', 'very', 'very', 'awesome']);
        chain().is().great();
        expect(chainRecord).toStrictEqual(['is', 'very', 'very', 'awesome', 'is', 'great']);

        reset();
        chain(1).chain(2).chain(3).chain(4);
        expect(chainRecord).toStrictEqual(['chain', 'chain', 'chain']);
        expect(paramsRecord).toStrictEqual([1, 2, 3, 4]);
    });

    // Snapshot helper — copies the live arrays so each step keeps its own state
    const snapshot = (data: { chain: string[]; index: number; key: null | string; params: any[] }) => ({
        chain: [...data.chain],
        index: data.index,
        key: data.key,
        params: [...data.params]
    });

    test('a single property access then call reports the exact step payload', () => {
        const records: any[] = [];
        const chain = functionChain((data) => { records.push(snapshot(data)); });

        chain.hello();

        // `.hello` get: index 1, key 'hello'. call: chain.push('hello'), no pending gap
        expect(records).toStrictEqual([{ chain: ['hello'], index: 1, key: 'hello', params: [] }]);
    });

    test('a root call with no preceding property access reports an empty chain and index 0', () => {
        const records: any[] = [];
        const chain = functionChain((data) => { records.push(snapshot(data)); });

        chain('hi');

        // `data.key === null` path -> reset() runs before the callback fires
        expect(records).toStrictEqual([{ chain: [], index: 0, key: null, params: ['hi'] }]);
    });

    test('a root call after previous steps resets the accumulated chain', () => {
        const records: any[] = [];
        const chain = functionChain((data) => { records.push(snapshot(data)); });

        // Build a non-empty chain, then make a bare root call
        chain.a();
        chain('b');

        expect(records).toStrictEqual([
            { chain: ['a'], index: 1, key: 'a', params: [] },
            // reset() replaces the array instance, so the fresh chain is observable
            { chain: [], index: 0, key: null, params: ['b'] }
        ]);
        expect(records[0].chain).not.toBe(records[1].chain);
    });

    test('a property read keeps its key for the next root call (proxy state persists)', () => {
        const records: any[] = [];
        const chain = functionChain((data) => { records.push(snapshot(data)); });

        // `chain.a` only reads; throughGetQuery is still true when the next call happens,
        // so `data.key` is 'a' (not null) and reset() is NOT reached
        chain.a;
        chain('reset');

        expect(records).toStrictEqual([{ chain: ['a'], index: 1, key: 'a', params: ['reset'] }]);

        // The following bare call finally reaches the reset path
        chain('again');
        expect(records[1]).toStrictEqual({ chain: [], index: 0, key: null, params: ['again'] });
    });

    test('multiple property accesses fire a deferred callback per access, then the call fires', () => {
        const records: any[] = [];
        const chain = functionChain((data) => { records.push(snapshot(data)); });

        chain.is.very.awesome('x');

        // Gets for `is`/`very` fire their own pending callback on the NEXT get;
        // the last get's pending is swallowed by the call (index === pending.index)
        expect(records).toStrictEqual([
            { chain: [], index: 1, key: 'is', params: [] },
            { chain: [], index: 2, key: 'very', params: [] },
            { chain: ['awesome'], index: 3, key: 'awesome', params: ['x'] }
        ]);
    });

    test('chain.ts:87 — pending callback fires when a nested call advances the index', () => {
        const records: any[] = [];
        let nestedDone = false;

        const chain: any = functionChain((data: any) => {
            records.push(snapshot(data));
            // Re-entrancy: while the `.b` get flushes the `.a` pending callback
            // (index 1, key 'a', no params) the user callback invokes the chain.
            // Inside that call the live index is already 2 while pending.index is 1,
            // which is exactly the `pending && index !== pending.index` branch.
            if (!nestedDone && data.index === 1 && data.key === 'a' && data.params.length === 0) {
                nestedDone = true;
                chain('nested');
            }
        });

        chain.a.b;
        chain('root');

        expect(records).toStrictEqual([
            // 1: deferred `.a` flush during the `.b` get
            { chain: [], index: 1, key: 'a', params: [] },
            // 2: line 87 — pending.callback(params) forwards the params ARRAY as one argument
            { chain: ['b'], index: 1, key: 'a', params: [['nested']] },
            // 3: the nested call's normal callback
            { chain: ['b'], index: 2, key: 'b', params: ['nested'] },
            // 4: line 87 again — the root call reset index to 0 while pending.index is 2
            { chain: [], index: 2, key: 'b', params: [['root']] },
            // 5: the root call's normal callback
            { chain: [], index: 0, key: null, params: ['root'] }
        ]);
    });

    test('chain.ts:87 — a throwing callback leaves pending with a stale index that fires on the next call', () => {
        const records: any[] = [];
        let thrown = false;

        const chain: any = functionChain((data: any) => {
            records.push(snapshot(data));
            // Throwing during the `.a` flush aborts the `.b` get BEFORE `pending` is
            // rewritten, so the old pending (index 1) survives while the index is 2.
            if (!thrown && data.key === 'a') {
                thrown = true;
                throw new Error('chain-cb-throw');
            }
        });

        expect(() => chain.a.b).toThrow('chain-cb-throw');
        chain('root');

        expect(records).toStrictEqual([
            { chain: [], index: 1, key: 'a', params: [] },
            // line 87 fires with the stale pending record
            { chain: ['b'], index: 1, key: 'a', params: [['root']] },
            { chain: ['b'], index: 2, key: 'b', params: ['root'] }
        ]);
    });

    test('a truthy callback return breaks the chain for the caller only', () => {
        const records: any[] = [];
        const chain = functionChain((data) => {
            records.push(snapshot(data));
            if (data.key === 'stop') return 'BREAK';
        });

        // The call hands the truthy value back instead of the chainable proxy
        const result: any = chain.stop();
        expect(result).toBe('BREAK');
        // Further property access on the returned value is inert (no callback fired)
        expect(result.go).toBeUndefined();
        expect(records).toStrictEqual([{ chain: ['stop'], index: 1, key: 'stop', params: [] }]);

        // The root proxy itself is unaffected and keeps chaining with the same index counter
        const again = chain.go();
        expect(again).toBe(chain);
        expect(records[1]).toStrictEqual({ chain: ['stop', 'go'], index: 2, key: 'go', params: [] });
    });

    test('a falsy callback return hands back the identical chainable proxy', () => {
        let calls = 0;
        const chain = functionChain(() => {
            calls++;
            return undefined;
        });

        // `result || chainFunction` — every falsy result continues the chain
        expect(chain('x')).toBe(chain);
        expect(chain.a()).toBe(chain);
        expect(chain()).toBe(chain);
        // The get branch always returns the proxy too
        expect(chain.a.b.c).toBe(chain);
        // 3 calls plus 2 deferred pending flushes from the `.b`/`.c` reads
        expect(calls).toBe(5);
    });

    test('sequential calls count the index per property access', () => {
        const records: any[] = [];
        // A block body matters: `records.push(...)` returns a number, and any truthy
        // callback result would be handed back instead of the chainable proxy
        const chain = functionChain((data) => {
            records.push(snapshot(data));
        });

        chain(1).chain(2).chain(3);

        expect(records).toStrictEqual([
            { chain: [], index: 0, key: null, params: [1] },
            { chain: ['chain'], index: 1, key: 'chain', params: [2] },
            { chain: ['chain', 'chain'], index: 2, key: 'chain', params: [3] }
        ]);
    });

    test('the callback receives the live chain array (shared reference, not a copy)', () => {
        const records: any[] = [];
        // Store the raw payload objects to expose the shared instance
        const chain = functionChain((data) => { records.push(data); });

        chain.is.very.awesome();

        // All three steps see the same array instance; later steps mutate it
        expect(records[0].chain).toBe(records[1].chain);
        expect(records[1].chain).toBe(records[2].chain);
        expect(records.map((r) => r.chain)).toStrictEqual([['awesome'], ['awesome'], ['awesome']]);
        // ...while each step still reported its own index/key at fire time
        expect(records.map((r) => ({ index: r.index, key: r.key }))).toStrictEqual([
            { index: 1, key: 'is' },
            { index: 2, key: 'very' },
            { index: 3, key: 'awesome' }
        ]);
    });

    test('property assignment on the chain proxy throws (no set case)', () => {
        const records: any[] = [];
        const chain = functionChain((data) => { records.push(snapshot(data)); });

        // chain.ts only switches on `call`/`get`; the set trap returns undefined,
        // and a falsish Proxy `set` result is a TypeError in strict mode.
        expect(() => {
            (chain as any).prop = 1;
        }).toThrow(TypeError);
        expect(records).toStrictEqual([]);
    });
});
