import { arrayWrapper } from './index';

/**
 * `arrayWrapper` factory contract (src/array/wrapper/index.ts).
 *
 * The factory returns a `(element, config?) => proxy` builder. Every property read
 * goes through the objectProxy `get` trap (index.ts:123-157), which resolves custom
 * extension callbacks FIRST and falls back to the built-in method map, so an
 * extension named like a built-in shadows it.
 */
describe('arrayWrapper', () => {
    const sample = ['apple', 'banana', 'cat', 'dog'];

    test('creates a wrapper factory', () => {
        expect(arrayWrapper()).toBeInstanceOf(Function);
        // The extension map is optional and defaults to {}
        expect(arrayWrapper({})).toBeInstanceOf(Function);
        const $array = arrayWrapper();
        // Arity is 1: `config` has a default value, so it is excluded from Function#length
        expect($array.length).toBe(1);
    });

    test('built-in methods are reachable through the proxy', () => {
        const wrapper = arrayWrapper()(sample);
        const builtins = ['get', 'keys', 'is', 'count', 'random', 'each', 'remove', 'select', 'retain'];
        expect(builtins.map((key) => [key, typeof (wrapper as any)[key]])).toStrictEqual([
            ['get', 'function'],
            ['keys', 'function'],
            ['is', 'function'],
            ['count', 'function'],
            ['random', 'function'],
            ['each', 'function'],
            ['remove', 'function'],
            ['select', 'function'],
            ['retain', 'function']
        ]);
        // Each built-in still produces its documented result
        expect(wrapper.get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect(wrapper.keys()).toStrictEqual([0, 1, 2, 3]);
        expect(wrapper.count()).toBe(4);
        expect(wrapper.is('empty')).toBe(false);
    });

    test('unknown properties resolve to undefined', () => {
        const wrapper = arrayWrapper()(sample);
        // The get trap returns `available[k]`, which is undefined for unknown keys
        expect((wrapper as any).notAMethod).toBeUndefined();
        expect(typeof (wrapper as any).notAMethod).toBe('undefined');
        // The proxy target is the placeholder function, which has no own enumerable keys
        expect(Object.keys(wrapper)).toStrictEqual([]);
    });

    test('the instance is a callable proxy backed by the placeholder handler', () => {
        const wrapper = arrayWrapper()(sample);
        // objectProxy wraps a function target, so the instance is callable...
        expect(typeof wrapper).toBe('function');
        // ...but calling it hits the not-yet-implemented placeholder (index.ts:117-119)
        expect((wrapper as any)()).toBeNull();
    });

    test('extension callbacks returning a valid value hand it back to the caller', () => {
        const $array = arrayWrapper({
            sum: ({ args, element }: any) => element.length + args[0],
            zero: () => 0,
            emptyString: () => '',
            falsey: () => false,
            object: () => ({ a: 1 })
        });
        const wrapper = $array(sample);
        expect(wrapper.sum(10)).toBe(14);
        // Only null/undefined fall back to the instance, so falsey values survive
        expect(wrapper.zero()).toBe(0);
        expect(wrapper.emptyString()).toBe('');
        expect(wrapper.falsey()).toBe(false);
        expect(wrapper.object()).toStrictEqual({ a: 1 });
    });

    test('extension callbacks returning null or undefined fall back to the instance', () => {
        const $array = arrayWrapper({
            nullish: () => null,
            undef: () => undefined
        });
        const wrapper = $array(sample);
        // isInvalid(value) is true only for null/undefined, so chaining resumes
        expect(wrapper.nullish()).toBe(wrapper);
        expect(wrapper.undef()).toBe(wrapper);
        expect(wrapper.nullish().get()).toStrictEqual(['apple', 'banana', 'cat', 'dog']);
        expect(wrapper.undef().keys()).toStrictEqual([0, 1, 2, 3]);
    });

    test('extension callbacks receive args plus the wrapper params', () => {
        let received: any = null;
        const $array = arrayWrapper({
            probe: (params: any) => {
                received = params;
                return null;
            }
        });
        const wrapper = $array(sample);
        wrapper.probe('x', 2);
        expect(received.args).toStrictEqual(['x', 2]);
        // No arguments supplied still yields an empty args array
        wrapper.probe();
        expect(received.args).toStrictEqual([]);
        expect(received.element).toBe(sample);
        expect(received.wrapper).toBeInstanceOf(Function);
        expect(received.instance).toBe(wrapper);
        // A root wrapper gets the default empty config object
        expect(Object.keys(received.config)).toStrictEqual([]);
        // Param keys are exactly these five (index.ts:125-130)
        expect(Object.keys(received).sort()).toStrictEqual(['args', 'config', 'element', 'instance', 'wrapper']);
    });

    test('the documented w/e/c/i aliases are not populated at runtime', () => {
        // Params declares w/e/c/i shorthands (index.ts:37-44) but the get trap only
        // builds wrapper/element/config/instance, so the aliases are undefined.
        let aliases: any = null;
        const $array = arrayWrapper({
            probe: (params: any) => {
                aliases = { w: params.w, e: params.e, c: params.c, i: params.i };
                return null;
            }
        });
        $array(sample).probe();
        expect(aliases).toStrictEqual({ w: undefined, e: undefined, c: undefined, i: undefined });
    });

    test('an extension callback shadows a built-in method of the same name', () => {
        const $array = arrayWrapper({ get: () => 'custom' });
        const wrapper = $array([1, 2]);
        expect(wrapper.get()).toBe('custom');
        // Other built-ins are unaffected
        expect(wrapper.count()).toBe(2);
        expect(wrapper.keys()).toStrictEqual([0, 1]);
    });

    test('the params wrapper factory can derive a new wrapper', () => {
        const $array = arrayWrapper({
            derive: ({ wrapper, element }: any) => wrapper([...element, 'extra']).get()
        });
        expect($array(['a']).derive()).toStrictEqual(['a', 'extra']);
    });

    test('wrappers over the same array share the element reference', () => {
        const source = [...sample];
        const first = arrayWrapper()(source);
        const second = arrayWrapper()(source);
        first.remove(0);
        // Both wrappers read the same mutated array
        expect(second.get()).toStrictEqual(['banana', 'cat', 'dog']);
        expect(source).toStrictEqual(['banana', 'cat', 'dog']);
    });

    test('an explicit config filter narrows the created wrapper', () => {
        const $array = arrayWrapper();
        const wrapper = $array(sample, { filter: [(data: any) => data.index < 2] });
        expect(wrapper.keys()).toStrictEqual([0, 1]);
        expect(wrapper.get()).toStrictEqual(['apple', 'banana']);
        expect(wrapper.count()).toBe(2);
        expect(wrapper.is('empty')).toBe(false);
    });

    test('G18: a no-element wrapper still calls to null, but count() throws', () => {
        // `arrayWrapper()()` builds the proxy with `element === undefined`: the
        // instance is the callable placeholder (index.ts:117-119), so invoking it
        // yields null, while any method that reads the element dereferences it.
        const wrapper = arrayWrapper()() as any;
        // The instance itself is the callable proxy, not the null it returns.
        expect(typeof wrapper).toBe('function');
        // Calling it runs the not-yet-implemented placeholder handler.
        expect(wrapper()).toBeNull();
        // Method reads do NOT go through the placeholder: `count` resolves to
        // countFunction, whose `instance.each` reaches arrayEach and reads
        // `list.length` on undefined (src/array/each.ts:59) => TypeError.
        expect(() => wrapper.count()).toThrow(TypeError);
        expect(() => wrapper.count()).toThrow("Cannot read properties of undefined (reading 'length')");
        // The same missing element breaks every other read path the same way.
        expect(() => wrapper.keys()).toThrow(TypeError);
        expect(() => wrapper.get()).toThrow(TypeError);
        expect(() => wrapper.is('empty')).toThrow(TypeError);
    });
});
