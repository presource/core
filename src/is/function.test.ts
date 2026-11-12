import { isFunction, isFunctionAsync } from '@presource/core';

// For Checking Standard Function
describe('Checking value is a Function type', () => {
    test('Checking all type of functions', () => {
        expect(isFunction(() => {})).toBe(true);
        expect(isFunction(() => 'hello')).toBe(true);
        expect(
            isFunction((a: number, b: number) => {
                return a + b;
            })
        ).toBe(true);
        expect(isFunction(() => () => {})).toBe(true);
        expect(isFunction(async () => {})).toBe(true);
    });

    test('Checking non-functions. These should return false', () => {
        expect(isFunction('()=>{}')).toBe(false);
        expect(isFunction('function')).toBe(false);
        expect(isFunction(undefined)).toBe(false);
        expect(isFunction(null)).toBe(false);
        expect(isFunction(1)).toBe(false);
        expect(isFunction(2)).toBe(false);
        expect(isFunction([])).toBe(false);
        expect(isFunction({})).toBe(false);
    });

    test('Check whether a function is async', () => {
        expect(isFunctionAsync('()=>{}')).toBe(false);
        expect(isFunctionAsync('function')).toBe(false);
        expect(isFunctionAsync(undefined)).toBe(false);
        expect(isFunctionAsync(null)).toBe(false);
        expect(isFunctionAsync(1)).toBe(false);
        expect(isFunctionAsync(2)).toBe(false);
        expect(isFunctionAsync([])).toBe(false);
        expect(isFunctionAsync({})).toBe(false);
        expect(isFunctionAsync(async () => {})).toBe(true);
    });

    // ------------------------------------------------------------------
    // The guards match on typeName(): 'function' / 'asyncfunction'. Generators
    // report 'generatorfunction' / 'asyncgeneratorfunction', so both guards reject them.
    // ------------------------------------------------------------------
    test('declared, class, bound and static members are functions', () => {
        function declared() {}
        async function declaredAsync() {}
        class Sample {
            static sync() {}
            static async asyncStatic() {}
            instance() {}
            async instanceAsync() {}
        }
        expect(isFunction(declared)).toBe(true);
        expect(isFunction(declaredAsync)).toBe(true);
        expect(isFunction(declared.bind(null))).toBe(true);
        expect(isFunction(Sample)).toBe(true);
        expect(isFunction(Sample.sync)).toBe(true);
        expect(isFunction(Sample.asyncStatic)).toBe(true);
        expect(isFunction(Sample.prototype.instance)).toBe(true);
        expect(isFunction(Sample.prototype.instanceAsync)).toBe(true);
        // Built-in constructors are functions too; Math is a plain object, so it is not
        expect(isFunction(Object)).toBe(true);
        expect(isFunction(Array)).toBe(true);
        expect(isFunction(isFunction)).toBe(true);
        expect(isFunction(Math)).toBe(false);
        // A function's prototype object is an object, not a function
        expect(isFunction(Sample.prototype)).toBe(false);
    });

    test('generators are functions to JS but not to these guards', () => {
        const generator = function* () {};
        const asyncGenerator = async function* () {};
        expect(isFunction(generator)).toBe(false);
        expect(isFunction(asyncGenerator)).toBe(false);
        expect(isFunctionAsync(generator)).toBe(false);
        expect(isFunctionAsync(asyncGenerator)).toBe(false);
    });

    // isFunctionAsync requires the exact 'asyncfunction' type name.
    test('isFunctionAsync accepts only async functions', () => {
        async function declaredAsync() {}
        class Sample {
            static async asyncStatic() {}
        }
        expect(isFunctionAsync(declaredAsync)).toBe(true);
        expect(isFunctionAsync(async () => {})).toBe(true);
        expect(isFunctionAsync(Sample.asyncStatic)).toBe(true);
        expect(isFunctionAsync(async function () {})).toBe(true);
        // Sync functions and classes are rejected by the async guard
        expect(isFunctionAsync(function sync() {})).toBe(false);
        expect(isFunctionAsync(() => {})).toBe(false);
        expect(isFunctionAsync(class Sample {})).toBe(false);
        expect(isFunctionAsync(Object)).toBe(false);
        // Symbol.asyncIterator is a symbol, not a function
        expect(isFunctionAsync(Symbol.asyncIterator)).toBe(false);
    });
});
