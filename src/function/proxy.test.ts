import { functionProxy, stringSwitch } from '@presource/core';

/**
 * Contract under test: `functionProxy(callback)` (src/function/proxy.ts).
 *
 * `currentKey` / `throughGetQuery` live in the factory closure and are per
 * `functionProxy` call (the TODO at proxy.ts:35 documents them as shared). The
 * `get` trap returns `callback(...) || target`, so a falsy trigger result leaks the
 * RAW unproxied target function, and a later call still reports the stale key.
 * The `set` trap must return a truthy value or the assignment throws.
 */
describe('Testing Proxy Function', () => {
    let expectedCurrentKey: any = null;
    let expectedParameters: any[] = [];

    // Constructing a proxied function
    const proxy = functionProxy(({ key, method, params }) => {
        // Checking the Key
        expect(key).toBe(expectedCurrentKey);
        // Depending on Method. It will be adjusted
        stringSwitch(method, {
            call: () => {
                // Only when called that parameters is equal
                expect(params).toStrictEqual(expectedParameters);
            },
            get: () => {
                // If Get. There are no Parameter set
                expect(params).toStrictEqual([]);
            }
        });
    });

    test('Basic usage of proxy function', () => {
        // Set the Expected Parameter
        expectedParameters = ['apple'];
        proxy('apple');

        // Checking Next Key
        expectedCurrentKey = 'update';
        proxy.update('apple');
        expectedParameters = [];
        proxy.update();

        expectedParameters = ['banana'];
        proxy.update('banana');

        // If went through the proxy function then the key is empty... or null?
        // Maybe null is better
        expectedCurrentKey = null;
        proxy('banana');

        // Updating
        expectedCurrentKey = '';
        expectedParameters = ['empty'];
        proxy['']('empty');
    });
});

describe('Proxy Function payloads', () => {
    test('a bare call reports a null key with the exact params', () => {
        const records: any[] = [];
        const proxy = functionProxy((data) => {
            records.push({ ...data, params: [...data.params] });
            return 'called';
        });

        expect((proxy as any)('root')).toBe('called');
        expect(records).toStrictEqual([{ key: null, method: 'call', params: ['root'] }]);
    });

    test('a property read then call reports both a get record and a keyed call record', () => {
        const records: any[] = [];
        const proxy = functionProxy((data) => {
            records.push({ ...data, params: [...data.params] });
        });

        (proxy as any).prop('v');

        expect(records).toStrictEqual([
            { key: 'prop', method: 'get', params: [] },
            { key: 'prop', method: 'call', params: ['v'] }
        ]);
    });

    test('a property read without a call leaves the key for the next call', () => {
        const records: any[] = [];
        const proxy = functionProxy((data) => {
            records.push({ key: data.key, method: data.method });
        });

        // `throughGetQuery` is only cleared by a call, so a following bare call
        // is still attributed to `pending`
        (proxy as any).pending;
        (proxy as any)('next');

        expect(records).toStrictEqual([
            { key: 'pending', method: 'get' },
            { key: 'pending', method: 'call' }
        ]);
    });

    test('each functionProxy call owns its own key state', () => {
        const a: string[] = [];
        const b: string[] = [];
        const proxyA = functionProxy((data) => a.push(`${data.method}:${String(data.key)}`));
        const proxyB = functionProxy((data) => b.push(`${data.method}:${String(data.key)}`));

        (proxyA as any).afterGet;
        (proxyB as any)('root');

        // proxyB never saw proxyA's read
        expect(a).toStrictEqual(['get:afterGet']);
        expect(b).toStrictEqual(['call:null']);
    });

    test('the get trap falls back to the raw target when the callback returns falsy', () => {
        const records: string[] = [];
        const proxy = functionProxy((data) => {
            records.push(`${data.method}:${String(data.key)}`);
            if (data.method === 'call') return 'CALL';
        });

        // Unknown properties resolve to the unproxied target function, not the proxy
        const fallback: any = (proxy as any).anything;
        expect(typeof fallback).toBe('function');
        expect(fallback === proxy).toBe(false);

        // Calling the leaked target still runs through the shared closure state
        expect(fallback('direct')).toBe('CALL');
        expect(records).toStrictEqual(['get:anything', 'call:anything']);
    });

    test('function metadata reads are not bypassed and leak the target', () => {
        const records: string[] = [];
        const proxy = functionProxy((data) => {
            records.push(`${data.method}:${String(data.key)}`);
        });

        // Unlike functionControl there is no exclusion list — `name` is just a key
        const name = (proxy as any).name;
        expect(typeof name).toBe('function');
        expect(name === proxy).toBe(false);
        expect(records).toStrictEqual(['get:name']);
    });

    test('a truthy get result overrides the property value', () => {
        const proxy = functionProxy((data) => (data.method === 'get' ? `over:${data.key}` : undefined));

        expect((proxy as any).field).toBe('over:field');
        expect((proxy as any).other).toBe('over:other');
    });

    test('symbol property access reports the symbol as the key', () => {
        const records: any[] = [];
        const symbol = Symbol('sym');
        const proxy = functionProxy((data) => {
            records.push({ key: data.key, method: data.method });
        });

        const value: any = (proxy as any)[symbol];

        expect(records).toStrictEqual([{ key: symbol, method: 'get' }]);
        // No call case matched, so the fallback target is returned
        expect(typeof value).toBe('function');
    });
});

describe('Proxy Function Set Method', () => {
    test('set method is intercepted with single value', () => {
        let setKey: string | null = null;
        let setParams: any[] = [];

        const proxy = functionProxy(({ key, method, params }) => {
            if (method === 'set') {
                setKey = key;
                setParams = params;
                return true;
            }
        });

        (proxy as any).prop = 'value';
        expect(setKey).toBe('prop');
        expect(setParams).toStrictEqual(['value']);
    });

    test('set method normalizes array value', () => {
        let setParams: any[] = [];

        const proxy = functionProxy(({ method, params }) => {
            if (method === 'set') {
                setParams = params;
                return true;
            }
        });

        (proxy as any).items = [1, 2, 3];
        expect(setParams).toStrictEqual([1, 2, 3]);
    });

    test('set method wraps non-array in array', () => {
        let setParams: any[] = [];

        const proxy = functionProxy(({ method, params }) => {
            if (method === 'set') {
                setParams = params;
                return true;
            }
        });

        (proxy as any).num = 42;
        expect(setParams).toStrictEqual([42]);
    });

    test('an array value is handed over by reference and an empty array stays empty', () => {
        const records: any[] = [];
        const proxy = functionProxy((data) => {
            if (data.method === 'set') {
                records.push({ key: data.key, params: data.params });
                return true;
            }
        });

        const items = [1, 2];
        (proxy as any).items = items;
        expect(records[0]).toEqual({ key: 'items', params: [1, 2] });
        expect(records[0].params).toBe(items);

        const empty: any[] = [];
        (proxy as any).empty = empty;
        expect(records[1]).toEqual({ key: 'empty', params: [] });
        expect(records[1].params).toBe(empty);
    });

    test('a non-array object is wrapped into a single element array', () => {
        const records: any[] = [];
        const proxy = functionProxy((data) => {
            if (data.method === 'set') {
                records.push({ key: data.key, params: [...data.params] });
                return true;
            }
        });

        (proxy as any).payload = { a: 1 };
        expect(records).toStrictEqual([{ key: 'payload', params: [{ a: 1 }] }]);
    });

    test('the set trap does not persist the value on the target', () => {
        const records: string[] = [];
        const proxy = functionProxy((data) => {
            records.push(`${data.method}:${String(data.key)}`);
            if (data.method === 'set') return true;
        });

        (proxy as any).stored = [1, 2];
        expect(records).toStrictEqual(['set:stored']);

        // Returning true without writing means nothing is stored; the next read
        // goes through the get trap and leaks the raw target function instead
        expect(typeof (proxy as any).stored).toBe('function');
        expect(records).toStrictEqual(['set:stored', 'get:stored']);
        expect(Object.keys(proxy)).toStrictEqual([]);
    });

    test('a falsy set result throws because the proxy trap returned falsish', () => {
        const proxy = functionProxy(() => undefined);

        expect(() => {
            (proxy as any).x = 1;
        }).toThrow("'set' on proxy: trap returned falsish for property 'x'");
    });
});
