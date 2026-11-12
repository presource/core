import { typeConstructor } from './constructor';

describe('typeConstructor', () => {
    test('should return constructor for string', () => {
        expect(typeConstructor('hello')).toBe(String);
    });

    test('should return constructor for number', () => {
        expect(typeConstructor(123)).toBe(Number);
    });

    test('should return constructor for boolean', () => {
        expect(typeConstructor(true)).toBe(Boolean);
    });

    test('should return constructor for array', () => {
        expect(typeConstructor([1, 2, 3])).toBe(Array);
    });

    test('should return constructor for object', () => {
        expect(typeConstructor({ key: 'value' })).toBe(Object);
    });

    test('should return undefined for null', () => {
        expect(typeConstructor(null)).toBeUndefined();
    });

    test('should return undefined for undefined', () => {
        expect(typeConstructor(undefined)).toBeUndefined();
    });

    test('should handle custom class instances', () => {
        class CustomClass {}
        expect(typeConstructor(new CustomClass())).toBe(CustomClass);
    });

    // `value?.constructor` reads through the auto-boxed wrapper object, so every
    // primitive still resolves to its intrinsic constructor.
    test('should auto-box primitives to their intrinsic constructors', () => {
        expect(typeConstructor('')).toBe(String);
        expect(typeConstructor(0)).toBe(Number);
        expect(typeConstructor(-0)).toBe(Number);
        expect(typeConstructor(NaN)).toBe(Number);
        expect(typeConstructor(Infinity)).toBe(Number);
        expect(typeConstructor(false)).toBe(Boolean);
        expect(typeConstructor(10n)).toBe(BigInt);
        expect(typeConstructor(Symbol('x'))).toBe(Symbol);
    });

    // Boxed primitives (wrapper objects) share the same constructor as the primitive.
    test('should return the wrapper constructor for boxed primitives', () => {
        expect(typeConstructor(new Number(5))).toBe(Number);
        expect(typeConstructor(new String('a'))).toBe(String);
        expect(typeConstructor(new Boolean(true))).toBe(Boolean);
        expect(typeConstructor(new Boolean(false))).toBe(Boolean);
    });

    // Every callable is constructed by `Function`, except generators/async generators
    // which have their own intrinsic constructors on the prototype chain.
    test('should return Function for callables', () => {
        const arrow = () => {};
        function declared() {}
        expect(typeConstructor(arrow)).toBe(Function);
        expect(typeConstructor(declared)).toBe(Function);
        expect(typeConstructor(class Sample {})).toBe(Function);
        expect(typeConstructor(Object)).toBe(Function);
    });

    test('should return the generator constructor for generator functions', () => {
        const generator = function* () {};
        // GeneratorFunction is not a global; resolve it through the instance prototype
        expect(typeConstructor(generator)).toBe(Object.getPrototypeOf(generator).constructor);
        expect(typeConstructor(generator).name).toBe('GeneratorFunction');
    });

    // Optional chaining short-circuits on `?.`, so a null-prototype object (which has no
    // `constructor` property at all) yields undefined just like null/undefined do.
    test('should return undefined for a null-prototype object', () => {
        expect(typeConstructor(Object.create(null))).toBeUndefined();
    });

    test('should resolve constructors through the prototype chain', () => {
        class CustomClass {
            method() {}
            static staticMethod() {}
        }
        const instance = new CustomClass();
        expect(typeConstructor(instance)).toBe(CustomClass);
        // Object.create() instances inherit `constructor` from their prototype
        expect(typeConstructor(Object.create(instance))).toBe(CustomClass);

        class Boom extends Error {}
        expect(typeConstructor(new Boom('x'))).toBe(Boom);
    });

    // An anonymous class expression has `name === ''`; the caller can still compare identity.
    test('should return the anonymous class constructor for an anonymous instance', () => {
        const instance = new (class {})();
        expect(typeConstructor(instance)).toBe(instance.constructor);
        expect(typeConstructor(instance).name).toBe('');
    });

    test('should return built-in constructors for host objects', () => {
        expect(typeConstructor(new Date(0))).toBe(Date);
        expect(typeConstructor(/ab/g)).toBe(RegExp);
        expect(typeConstructor(new Map())).toBe(Map);
        expect(typeConstructor(new Set())).toBe(Set);
        expect(typeConstructor(Promise.resolve())).toBe(Promise);
        expect(typeConstructor(new Error('x'))).toBe(Error);
        // Math is a plain object, so its constructor is Object
        expect(typeConstructor(Math)).toBe(Object);
        expect(typeConstructor(Object.prototype)).toBe(Object);
        expect(typeConstructor(new Proxy({}, {}))).toBe(Object);
    });
});
