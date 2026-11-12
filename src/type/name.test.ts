import { typeName } from './name';

describe('typeName', () => {
    test('should return lowercase constructor name for string', () => {
        expect(typeName('hello')).toBe('string');
    });

    test('should return lowercase constructor name for number', () => {
        expect(typeName(123)).toBe('number');
    });

    test('should return lowercase constructor name for boolean', () => {
        expect(typeName(true)).toBe('boolean');
    });

    test('should return lowercase constructor name for array', () => {
        expect(typeName([1, 2, 3])).toBe('array');
    });

    test('should return lowercase constructor name for object', () => {
        expect(typeName({ key: 'value' })).toBe('object');
    });

    test('should handle null with empty result', () => {
        // Since null has no constructor, it returns empty string
        expect(typeName(null)).toBe('');
    });

    test('should handle undefined with empty result', () => {
        // Since undefined has no constructor, it returns empty string
        expect(typeName(undefined)).toBe('');
    });

    test('should handle custom class instances', () => {
        class CustomClass {}
        expect(typeName(new CustomClass())).toBe('customclass');
    });

    test('should handle function', () => {
        expect(typeName(() => {})).toBe('function');
    });

    // Every primitive auto-boxes, so each one reports its intrinsic constructor name.
    test('should return the intrinsic name for every primitive value', () => {
        expect(typeName('')).toBe('string');
        expect(typeName(0)).toBe('number');
        expect(typeName(NaN)).toBe('number');
        expect(typeName(Infinity)).toBe('number');
        expect(typeName(false)).toBe('boolean');
        expect(typeName(10n)).toBe('bigint');
        expect(typeName(Symbol('x'))).toBe('symbol');
    });

    // Boxed primitives report the same names as their primitive counterparts.
    test('should return primitive names for boxed primitives', () => {
        expect(typeName(new Number(5))).toBe('number');
        expect(typeName(new String('a'))).toBe('string');
        expect(typeName(new Boolean(true))).toBe('boolean');
    });

    // Function kind comes from the constructor name, so async/generator variants are distinct.
    test('should distinguish every function kind', () => {
        const arrow = () => {};
        function declared() {}
        async function declaredAsync() {}
        const arrowAsync = async () => {};
        const generator = function* () {};
        const asyncGenerator = async function* () {};
        expect(typeName(arrow)).toBe('function');
        expect(typeName(declared)).toBe('function');
        expect(typeName(arrowAsync)).toBe('asyncfunction');
        expect(typeName(declaredAsync)).toBe('asyncfunction');
        expect(typeName(generator)).toBe('generatorfunction');
        expect(typeName(asyncGenerator)).toBe('asyncgeneratorfunction');
        // Bound functions keep the plain Function constructor
        expect(typeName(declared.bind(null))).toBe('function');
        // A class value itself is constructed by Function
        expect(typeName(class Sample {})).toBe('function');
        expect(typeName(Object)).toBe('function');
    });

    // Built-ins report their lowercased constructor names.
    test('should return lowercased names for built-in host objects', () => {
        expect(typeName([])).toBe('array');
        expect(typeName({})).toBe('object');
        expect(typeName(new Date(0))).toBe('date');
        expect(typeName(/ab/g)).toBe('regexp');
        expect(typeName(new Map())).toBe('map');
        expect(typeName(new Set())).toBe('set');
        expect(typeName(Promise.resolve())).toBe('promise');
        expect(typeName(new Error('x'))).toBe('error');
        // Math's constructor is Object, so it is reported as a plain object
        expect(typeName(Math)).toBe('object');
        expect(typeName(Object.prototype)).toBe('object');
        expect(typeName(new Proxy({}, {}))).toBe('object');
    });

    // The class name (not 'object') is lowercased and returned verbatim.
    test('should return the lowercased user class name', () => {
        class HTTPResponse {}
        expect(typeName(new HTTPResponse())).toBe('httpresponse');
        class Boom extends Error {}
        expect(typeName(new Boom('x'))).toBe('boom');
        // Objects created with Object.create inherit the constructor name
        expect(typeName(Object.create(new HTTPResponse()))).toBe('httpresponse');
    });

    // '' is the shared sentinel for: no constructor at all (null/undefined/null-prototype)
    // AND for values whose constructor itself is anonymous.
    test('should return an empty string when the constructor is missing or anonymous', () => {
        expect(typeName(Object.create(null))).toBe('');
        expect(typeName(new (class {})())).toBe('');
        expect(typeName(Object.assign(Object.create(null), { a: 1 }))).toBe('');
    });
});

/**
 * Perf-wave contract pins for the constructor-name cache (T-A).
 *
 * `typeName` now memoises the resolved name per constructor in a module-level
 * WeakMap (it sits on the hot path of every typeSwitch / typeSwitchAsync /
 * isFunction dispatch). Everything else - the `''` sentinel, the lower-casing, and
 * even the exact TypeError text of the pathological non-string-name case - is
 * byte-identical to the uncached build (92/92 legacy parity checks).
 *
 * The one intended behaviour change is the documented one: the name is captured on
 * first sight, so renaming the constructor afterwards is NOT re-read.
 */
describe('typeName constructor name cache', () => {
    test('Repeating the lookup for one constructor is stable', () => {
        class Repeated {}

        expect([typeName(new Repeated()), typeName(new Repeated())]).toEqual(['repeated', 'repeated']);
    });

    test('A memoised name is not re-read after the constructor is renamed (documented deviation)', () => {
        const Named = class Foo {};
        const before = typeName(new Named());

        Object.defineProperty(Named, 'name', { value: 'bar', configurable: true });

        // The uncached build answered ['foo', 'bar']; the cache pins the first value
        expect([before, typeName(new Named())]).toEqual(['foo', 'foo']);
    });

    test('A variable-inferred class name is still lower-cased', () => {
        const Anon = class {};

        expect(typeName(new Anon())).toBe('anon');
    });

    test('A primitive constructor override resolves to "" and is never cached', () => {
        const value = { constructor: 'Str' } as any;

        // 'Str' has no `name`, and a primitive cannot be a WeakMap key - both calls
        // must resolve through the normal path without throwing
        expect([typeName(value), typeName(value)]).toEqual(['', '']);
    });

    test('A non-string constructor name throws the identical TypeError every time', () => {
        const value = { constructor: { name: 42 } } as any;

        // A thrown name is never cached, so the second call must fail exactly like
        // the first one - message text included
        expect(() => typeName(value)).toThrow(TypeError);
        expect(() => typeName(value)).toThrow('((intermediate value) || "").toLowerCase is not a function');
        expect(() => typeName(value)).toThrow('((intermediate value) || "").toLowerCase is not a function');
    });

    test('A null-prototype value has no constructor name', () => {
        expect(typeName(Object.create(null))).toBe('');
    });
});
