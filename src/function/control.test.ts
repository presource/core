import { functionControl } from '@presource/core';

/**
 * Contract under test: `functionControl(callback)` (src/function/control.ts).
 *
 * The callback is wrapped by `objectProxy` (src/object/proxy.ts) around a real
 * function, so:
 * - invoking the result runs the target directly and hands the callback `{}`
 * - reading any property hands the callback `{ key }` (objectProxy returns the
 *   trigger result verbatim — there is no fallback to the target)
 * - `'name' | 'prototype' | 'displayName'` are bypassed and resolve to `undefined`
 *   (the bypass set is the module-level `EXCLUDED_KEYS` Set at src/function/control.ts:20,
 *   matched with `Set.prototype.has`; every other built-in name is an ordinary key)
 * - there is no `set` trigger, so assignment writes straight through to the target
 */
describe('functionControl requirements', () => {
    it('should able to create a controlling object', () => {
        const availableFruits = {
            apple: () => 'apple',
            banana: () => 'banana'
        };

        // Building a controlling fruit object
        const fruits = functionControl(({ key }) => {
            // Return the value or return serror
            return (availableFruits as any)[key] || (() => 'error');
        });

        // Expecting calling apple to return apple
        expect(fruits.apple()).toBe('apple');
        expect(fruits.banana()).toBe('banana');
        expect(fruits.orange()).toBe('error');
    });

    it('should invoke callback when called as function', () => {
        let called = false;
        const ctrl = functionControl(() => {
            called = true;
            return 'called';
        });

        const result = (ctrl as any)();
        expect(called).toBe(true);
        expect(result).toBe('called');
    });

    it('should bypass metadata properties', () => {
        let intercepted = false;
        const ctrl = functionControl(({ key }) => {
            intercepted = true;
            return key;
        });

        // Accessing metadata properties should not trigger callback
        (ctrl as any).name;
        (ctrl as any).prototype;
        (ctrl as any).displayName;
        expect(intercepted).toBe(false);

        // objectProxy returns the trigger result verbatim, so bypassed keys are undefined
        expect((ctrl as any).name).toBeUndefined();
        expect((ctrl as any).prototype).toBeUndefined();
        expect((ctrl as any).displayName).toBeUndefined();
    });

    it('passes an empty object payload when invoked directly', () => {
        const records: any[] = [];
        const ctrl = functionControl((data) => {
            records.push(data);
            return 'root';
        });

        const result = (ctrl as any)();

        // handlerFunction calls callback({}) — the payload has no `key` at all
        expect(records).toStrictEqual([{}]);
        expect(Object.keys(records[0])).toStrictEqual([]);
        expect(result).toBe('root');
    });

    it('passes the accessed key when a property is read', () => {
        const records: any[] = [];
        const ctrl = functionControl((data) => {
            records.push({ ...data });
            return `value:${data.key}`;
        });

        expect((ctrl as any).apple).toBe('value:apple');
        expect((ctrl as any).banana).toBe('value:banana');

        // One record per read, each with exactly `{ key }`
        expect(records).toStrictEqual([{ key: 'apple' }, { key: 'banana' }]);
    });

    it('treats other function built-ins as ordinary keys', () => {
        const records: string[] = [];
        const ctrl = functionControl(({ key }) => {
            records.push(key);
            return `v:${key}`;
        });

        // Only the three metadata names are excluded from interception
        expect((ctrl as any).length).toBe('v:length');
        expect((ctrl as any).call).toBe('v:call');
        expect((ctrl as any).apply).toBe('v:apply');
        expect(records).toStrictEqual(['length', 'call', 'apply']);
    });

    it('intercepts symbol keyed reads and forwards the symbol as the key', () => {
        const records: any[] = [];
        const symbol = Symbol('symbol-key');
        const ctrl = functionControl((data) => {
            records.push({ ...data });
            return `v:${String(data.key)}`;
        });

        expect((ctrl as any)[symbol]).toBe('v:Symbol(symbol-key)');
        expect(records).toHaveLength(1);
        expect(records[0].key).toBe(symbol);
    });

    it('writes assignments straight through without invoking the callback', () => {
        const records: any[] = [];
        const ctrl = functionControl((data) => {
            records.push({ ...data });
            return `v:${data.key}`;
        });

        // No `set` trigger is registered on objectProxy, so the default write happens
        (ctrl as any).assigned = 99;
        expect(records).toStrictEqual([]);
        expect(Object.keys(ctrl)).toStrictEqual(['assigned']);

        // Reading the same key still routes through the callback, not the stored value
        expect((ctrl as any).assigned).toBe('v:assigned');
        expect(records).toStrictEqual([{ key: 'assigned' }]);
    });

    it('returns a callable function object', () => {
        const ctrl = functionControl(() => 'value');

        expect(typeof ctrl).toBe('function');
        // Calling it never depends on a preceding property read
        expect((ctrl as any)()).toBe('value');
        expect((ctrl as any)()).toBe('value');
    });

    it('lets the callback return nested objects for chained reads', () => {
        // Returning the control object itself keeps the DSL going
        const nest: any = functionControl(({ key }) => (key === 'a' ? nest : 'leaf'));
        expect(nest.a.b).toBe('leaf');

        // Returning a plain object means later reads happen on that object, not the proxy
        const records: string[] = [];
        const obj = functionControl(({ key }) => {
            records.push(key);
            return { inner: 'deep' };
        });
        expect((obj as any).anything.inner).toBe('deep');
        expect(records).toStrictEqual(['anything']);
    });
});
