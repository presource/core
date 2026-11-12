import { objectProxy } from '@presource/core';

describe('Object Proxy - Proxifying an Object', () => {
    test('Basic Object Spying', () => {
        const object: any = {};

        // Proxied Object
        const proxied = objectProxy(object, {
            get: () => {
                // Spying on GET
                expect.assertions(1);
            }
        });

        proxied.value = true;
        // Proxied Object
        expect(object).toStrictEqual({ value: true });
    });

    test('Basic Proxifying an Object', () => {
        const object: any = {};

        const proxied = objectProxy(object, {
            get: () => {
                // Spying on GET
                expect.assertions(1);
            },
            set: () => {
                // Spying on SET
                expect.assertions(2);
                return true;
            }
        });

        // Checking if Proxied value is undefined
        expect(proxied.value).toBeUndefined();
        // Triggering Proxied Value update
        proxied.value = 5;
        // No changes
        expect(object).toStrictEqual({});
    });

    test('Can bypass set or update', () => {
        const object: { [key: string]: any } = {};

        const proxied = objectProxy(object, {
            set: ({ k, v, o }) => {
                if (k === 'banana') {
                    // Updating
                    o[k] = v;
                }
            }
        });

        proxied.apple = 'hello';
        proxied.banana = 'yes';

        expect(object).toStrictEqual({ banana: 'yes' });
    });

    test('get trap without callback returns object value directly', () => {
        const object = { foo: 'bar' };
        const proxied = objectProxy(object as any, {
            set: ({ k, v, o }) => {
                o[k] = v;
            }
        });

        // Reading property with no get callback should return object[key]
        expect(proxied.foo).toBe('bar');
    });

    test('get trap without callback returns the stored reference untouched', () => {
        const nested = { deep: 1 };
        const object: any = { nested, list: [1, 2] };
        // No triggers at all: the proxy behaves like the raw object
        const proxied = objectProxy(object, {});

        expect(proxied.nested).toBe(nested);
        expect(proxied.list).toBe(object.list);
        expect(proxied.missing).toBeUndefined();

        // Reads must not have introduced any keys
        expect(Object.keys(object)).toStrictEqual(['nested', 'list']);
    });

    test('get trigger receives both long and short payload aliases', () => {
        const object: any = { known: 'value' };
        const payloads: any[] = [];
        const proxied = objectProxy(object, {
            get: (args) => {
                payloads.push(args);
                return args.value;
            }
        });

        expect(proxied.known).toBe('value');
        expect(proxied.missing).toBeUndefined();

        expect(payloads).toHaveLength(2);
        // Exactly these eight keys, no more (long aliases plus the shorthand mirrors)
        expect(Object.keys(payloads[0])).toStrictEqual(['key', 'value', 'object', 'method', 'k', 'v', 'o', 'm']);
        expect({ ...payloads[0], object: undefined, o: undefined }).toStrictEqual({
            key: 'known',
            value: 'value',
            object: undefined,
            method: 'get',
            k: 'known',
            v: 'value',
            o: undefined,
            m: 'get'
        });
        expect(payloads[0].object).toBe(object);
        expect(payloads[0].o).toBe(object);

        expect({ ...payloads[1], object: undefined, o: undefined }).toStrictEqual({
            key: 'missing',
            value: undefined,
            object: undefined,
            method: 'get',
            k: 'missing',
            v: undefined,
            o: undefined,
            m: 'get'
        });
    });

    test('get trigger return value replaces whatever is read', () => {
        const object: any = { a: 'stored', b: 'stored' };
        const proxied = objectProxy(object, { get: () => 'OVERRIDE' });

        expect(proxied.a).toBe('OVERRIDE');
        expect(proxied.b).toBe('OVERRIDE');
        // The override never touches the target
        expect(object).toStrictEqual({ a: 'stored', b: 'stored' });
    });

    test('get trigger returning undefined hides an existing value', () => {
        const object: any = { has: 'value' };
        const proxied = objectProxy(object, { get: () => undefined });

        // An explicit undefined return is used as-is (no fallback to the stored value)
        expect(proxied.has).toBeUndefined();
        expect(object.has).toBe('value');
    });

    test('set trigger that does not self-assign drops the write', () => {
        const object: any = { keep: 'original' };
        const seen: any[] = [];
        const proxied = objectProxy(object, {
            set: (args) => {
                seen.push(args);
                // Returns undefined: the trap reports success but performs no assignment
            }
        });

        proxied.added = 1;

        expect(seen).toHaveLength(1);
        expect({ ...seen[0], object: undefined, o: undefined }).toStrictEqual({
            key: 'added',
            value: 1,
            object: undefined,
            method: 'set',
            k: 'added',
            v: 1,
            o: undefined,
            m: 'set'
        });
        expect(seen[0].object).toBe(object);
        expect(seen[0].o).toBe(object);

        // Neither the new key nor the existing one changed
        expect(object).toStrictEqual({ keep: 'original' });
        expect(proxied.added).toBeUndefined();
    });

    test('set trigger returning false rejects the write with a TypeError', () => {
        const object: any = {};
        const proxied = objectProxy(object, { set: () => false });

        // A falsish trap result makes the strict-mode assignment throw
        let failure: any = null;
        try {
            proxied.blocked = 1;
        } catch (error: any) {
            failure = { threw: true, name: error.constructor.name };
        }

        expect(failure).toStrictEqual({ threw: true, name: 'TypeError' });
        expect(object).toStrictEqual({});
    });

    test('set trigger returning true is accepted but still does not write', () => {
        const object: any = {};
        const proxied = objectProxy(object, { set: () => true });

        proxied.unwritten = 1;

        // `true` means "handled", so no assignment is performed by the proxy itself
        expect(object).toStrictEqual({});
        expect(proxied.unwritten).toBeUndefined();
    });

    test('set trigger returning a truthy non-boolean is treated as success', () => {
        const object: any = {};
        const proxied = objectProxy(object, { set: () => 'replaced' });

        let expressionValue: any = null;
        let failure: any = null;
        try {
            expressionValue = (proxied.a = 1);
        } catch (error: any) {
            failure = { threw: true, name: error.constructor.name };
        }

        expect(failure).toBeNull();
        // The assignment expression still evaluates to the right-hand value
        expect(expressionValue).toBe(1);
        expect(object).toStrictEqual({});
    });

    test('set trigger returning null behaves like a plain success', () => {
        const object: any = {};
        const proxied = objectProxy(object, { set: () => null });

        proxied.a = 1;

        // null is an "invalid" result, so the trap falls back to returning true
        expect(object).toStrictEqual({});
    });

    test('set trigger can transform the value before storing it', () => {
        const object: any = {};
        const proxied = objectProxy(object, {
            set: ({ k, v, o }) => {
                // The trigger owns the assignment, so it may store something else entirely
                o[k] = v * 2;
            }
        });

        proxied.n = 21;

        expect(object).toStrictEqual({ n: 42 });
        expect(proxied.n).toBe(42);
    });

    test('set without a set trigger performs the ordinary assignment', () => {
        const object: any = { a: 1 };
        const fired: string[] = [];
        const proxied = objectProxy(object, {
            get: ({ key, value }) => {
                fired.push(`${key}=${String(value)}`);
                return value;
            }
        });

        // Only a get trigger exists, so writes fall through to the target
        proxied.b = 2;

        expect(object).toStrictEqual({ a: 1, b: 2 });
        expect(fired).toStrictEqual([]);
    });

    test('symbol keys reach the triggers as symbols and land on the target', () => {
        const KEY = Symbol('token');
        const object: any = {};
        const seen: any[] = [];
        const proxied = objectProxy(object, {
            get: (args) => {
                seen.push({ phase: 'get', keyType: typeof args.key, key: String(args.key) });
                return args.value;
            },
            set: (args) => {
                seen.push({ phase: 'set', keyType: typeof args.key, key: String(args.key) });
                object[args.key] = args.value;
            }
        });

        proxied[KEY] = 42;
        expect(proxied[KEY]).toBe(42);

        // The declared `key: string` is not enforced at runtime: symbols arrive untouched
        expect(seen).toStrictEqual([
            { phase: 'set', keyType: 'symbol', key: 'Symbol(token)' },
            { phase: 'get', keyType: 'symbol', key: 'Symbol(token)' }
        ]);
        expect(Object.keys(object)).toStrictEqual([]);
        expect(object[KEY]).toBe(42);
    });

    test('internal well-known symbol reads also pass through the get trigger', () => {
        const object: any = { a: 1 };
        const fired: string[] = [];
        const proxied = objectProxy(object, {
            get: (args) => {
                fired.push(String(args.key));
                return args.value;
            }
        });

        // Stringifying the proxy triggers engine-internal lookups, each reported as a payload
        expect(`${proxied}`).toBe('[object Object]');
        expect(fired).toStrictEqual([
            'Symbol(Symbol.toPrimitive)',
            'toString',
            'Symbol(Symbol.toStringTag)'
        ]);
    });
});

describe('Object Proxy - params lifetime and trigger fast paths', () => {
    // Trade-off T3: the params object is allocated per access and never reused, so a trigger that
    // keeps the payload must still see the values it was given after later accesses.
    test('retained get payloads keep their values after later reads', () => {
        const object: any = { first: 1, second: 2 };
        const seen: any[] = [];
        const proxied = objectProxy(object, {
            get: (args) => {
                seen.push(args);
                return args.value;
            }
        });

        const first = proxied.first;
        const second = proxied.second;

        expect([first, second]).toStrictEqual([1, 2]);
        // Asserted after both reads: a shared/reused payload object would have been rewritten
        expect(seen.map((args) => ({ ...args, object: undefined, o: undefined }))).toStrictEqual([
            { key: 'first', value: 1, object: undefined, method: 'get', k: 'first', v: 1, o: undefined, m: 'get' },
            { key: 'second', value: 2, object: undefined, method: 'get', k: 'second', v: 2, o: undefined, m: 'get' }
        ]);
        expect(seen[0] === seen[1]).toBe(false);
        expect(seen[0].object === object).toBe(true);
        expect(seen[0].o === object).toBe(true);
    });

    test('retained set payloads keep their values after a later write', () => {
        const object: any = {};
        const seen: any[] = [];
        const proxied = objectProxy(object, {
            set: (args) => {
                seen.push(args);
                object[args.key] = args.value;
            }
        });

        proxied.n = 1;
        proxied.n = 2;

        expect(seen.map((args) => ({ ...args, object: undefined, o: undefined }))).toStrictEqual([
            { key: 'n', value: 1, object: undefined, method: 'set', k: 'n', v: 1, o: undefined, m: 'set' },
            { key: 'n', value: 2, object: undefined, method: 'set', k: 'n', v: 2, o: undefined, m: 'set' }
        ]);
        expect(seen[0] === seen[1]).toBe(false);
        expect(object).toStrictEqual({ n: 2 });
    });

    test('with no triggers at all the proxy behaves as a plain pass-through object', () => {
        const object: any = { keep: 1 };
        const proxied = objectProxy(object, {});

        proxied.added = 2;

        // No params object is built on either trap when no interceptor is registered
        expect(proxied.keep).toBe(1);
        expect(proxied.added).toBe(2);
        expect(proxied.missing).toBeUndefined();
        expect(object).toStrictEqual({ keep: 1, added: 2 });
        expect(Object.keys(object)).toStrictEqual(['keep', 'added']);
    });

    test('an accessor read fires once per access when no get trigger is registered', () => {
        let fires = 0;
        const object: any = {
            get lazy() {
                fires += 1;
                return fires;
            }
        };
        // Only a `set` interceptor: the `get` trap short-circuits to a single target read
        const proxied = objectProxy(object, { set: ({ k, v, o }) => { o[k] = v; } });

        const first = proxied.lazy;
        const second = proxied.lazy;

        expect([first, second, fires]).toStrictEqual([1, 2, 2]);
    });

    test('an accessor read fires once per access with a get trigger registered', () => {
        let fires = 0;
        const seen: any[] = [];
        const object: any = {
            get lazy() {
                fires += 1;
                return fires;
            }
        };
        const proxied = objectProxy(object, {
            get: (args) => {
                seen.push({ key: args.key, value: args.value, v: args.v });
                return args.value;
            }
        });

        const first = proxied.lazy;

        expect(first).toBe(1);
        expect(fires).toBe(1);
        expect(seen).toStrictEqual([{ key: 'lazy', value: 1, v: 1 }]);
    });

    test('a set without a set trigger writes straight through, with no get noise', () => {
        const object: any = { a: 1 };
        const proxied = objectProxy(object, {
            get: ({ key, value }) => value
        });

        proxied.b = 2;
        proxied.c = 3;

        // The `get`-only trigger set keeps the ordinary assignment path for writes
        expect(object).toStrictEqual({ a: 1, b: 2, c: 3 });
        expect(proxied.b).toBe(2);
    });
});
