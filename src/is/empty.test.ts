import { isEmpty, isEmptyArray, isEmptyObject } from '@presource/core';

describe('isEmpty', () => {
    test('Testing isEmptyArray', () => {
        expect(isEmptyArray([])).toBe(true);
        expect(isEmptyArray([[]])).toBe(true);
        expect(isEmptyArray([[], [], []])).toBe(true);
        expect(isEmptyArray([{}])).toBe(true);
        expect(isEmptyArray([1])).toBe(false);
    });

    test('Testing isEmptyObject', () => {
        expect(isEmptyObject({})).toBe(true);
        expect(isEmptyObject({ a: 1, b: 2 })).toBe(false);
        expect(isEmptyObject({ a: null, b: undefined })).toBe(false);
        // Can also check nesting validations
        expect(isEmptyObject({ a: {} })).toBe(true);
        expect(isEmptyObject({ a: { b: { c: {} } } })).toBe(true);
        // By Default. Empty string is empty
        expect(isEmptyObject({ a: { b: { c: { d: '' } } } })).toBe(true);
    });

    // Major testing isEmpty
    test('isEmpty main function', () => {
        // These are basic format
        expect(isEmpty('')).toBe(true);
        expect(isEmpty(' ')).toBe(true);
        expect(isEmpty([])).toBe(true);
        expect(isEmpty({})).toBe(true);
        expect(isEmpty(NaN)).toBe(true);

        expect(isEmpty('a')).toBe(false);
        expect(isEmpty('1')).toBe(false);
    });

    // ------------------------------------------------------------------
    // Per-type criteria (typeSwitch dispatch): number => isNaN, string => trim,
    // array/object => recursive emptiness, everything else => `!!input`.
    // ------------------------------------------------------------------
    test('numbers are only empty when NaN', () => {
        expect(isEmpty(0)).toBe(false);
        expect(isEmpty(-0)).toBe(false);
        expect(isEmpty(1)).toBe(false);
        expect(isEmpty(-1.5)).toBe(false);
        expect(isEmpty(Infinity)).toBe(false);
        expect(isEmpty(-Infinity)).toBe(false);
        expect(isEmpty(NaN)).toBe(true);
        // Boxed numbers route through the number case: isNaN() coerces the wrapper
        expect(isEmpty(new Number(5))).toBe(false);
        expect(isEmpty(new Number(NaN))).toBe(true);
    });

    test('strings are empty when whitespace-only', () => {
        expect(isEmpty('')).toBe(true);
        expect(isEmpty(' ')).toBe(true);
        expect(isEmpty('   ')).toBe(true);
        expect(isEmpty('\n\t ')).toBe(true);
        expect(isEmpty('a')).toBe(false);
        expect(isEmpty(' a ')).toBe(false);
        expect(isEmpty('0')).toBe(false);
        // Boxed strings behave like primitives here (String.prototype.trim is callable)
        expect(isEmpty(new String(''))).toBe(true);
        expect(isEmpty(new String('x'))).toBe(false);
    });

    test('arrays are empty only when every element is empty (recursive)', () => {
        expect(isEmpty([])).toBe(true);
        expect(isEmpty([[]])).toBe(true);
        expect(isEmpty([[[]]])).toBe(true);
        expect(isEmpty([NaN])).toBe(true);
        expect(isEmpty(['  '])).toBe(true);
        expect(isEmpty([{}])).toBe(true);
        expect(isEmpty([{ a: {} }])).toBe(true);
        expect(isEmpty([{ a: [] }])).toBe(true);
        expect(isEmpty([{ a: '' }])).toBe(true);
        // null / undefined are NOT empty here (the default branch is `!!input`)
        expect(isEmpty([null])).toBe(false);
        expect(isEmpty([undefined])).toBe(false);
        expect(isEmpty([0])).toBe(false);
        expect(isEmpty([false])).toBe(false);
        expect(isEmpty([1])).toBe(false);
        expect(isEmpty([[1]])).toBe(false);
        expect(isEmpty([{ a: 0 }])).toBe(false);
    });

    test('objects are empty only when every property value is empty (recursive)', () => {
        expect(isEmpty({})).toBe(true);
        expect(isEmpty({ a: {} })).toBe(true);
        expect(isEmpty({ a: { b: [] } })).toBe(true);
        expect(isEmpty({ a: { b: { c: {} } } })).toBe(true);
        expect(isEmpty({ a: { b: { c: { d: '' } } } })).toBe(true);
        expect(isEmpty({ a: '' })).toBe(true);
        expect(isEmpty({ a: NaN })).toBe(true);
        expect(isEmpty({ a: [] })).toBe(true);
        expect(isEmpty({ a: [''] })).toBe(true);
        expect(isEmpty({ a: [{ b: '' }] })).toBe(true);
        expect(isEmpty({ a: { b: [] }, c: '' })).toBe(true);
        expect(isEmpty({ a: 0 })).toBe(false);
        expect(isEmpty({ a: null })).toBe(false);
        expect(isEmpty({ a: undefined })).toBe(false);
        expect(isEmpty({ a: false })).toBe(false);
        expect(isEmpty({ a: 'x' })).toBe(false);
        expect(isEmpty({ a: ['x'] })).toBe(false);
        expect(isEmpty({ a: { b: { c: 0 } } })).toBe(false);
        expect(isEmpty({ a: { b: null } })).toBe(false);
    });

    // The default branch is `!!input`: truthy non-empty types report EMPTY (documented quirk).
    test('non-collection values fall back to truthiness', () => {
        expect(isEmpty(null)).toBe(false);
        expect(isEmpty(undefined)).toBe(false);
        expect(isEmpty(true)).toBe(true);
        expect(isEmpty(false)).toBe(false);
        expect(isEmpty(10n)).toBe(true);
        expect(isEmpty(0n)).toBe(false);
        expect(isEmpty(Symbol('s'))).toBe(true);
        expect(isEmpty(new Date(0))).toBe(true);
        expect(isEmpty(/a/)).toBe(true);
        expect(isEmpty(new Map())).toBe(true);
        expect(isEmpty(new Set())).toBe(true);
        expect(isEmpty(Math)).toBe(true);
        expect(isEmpty(() => {})).toBe(true);
        expect(isEmpty(class Sample {})).toBe(true);
        expect(isEmpty(Promise.resolve())).toBe(true);
        expect(isEmpty(new Error('x'))).toBe(true);
        // Boxed false is an object, so it is truthy and therefore "empty"
        expect(isEmpty(new Boolean(false))).toBe(true);
    });

    // A null-prototype object has no constructor, so typeSwitch routes it to the
    // (missing) `null` case and the default branch decides: `!!input` => true.
    test('null-prototype objects fall back to truthiness', () => {
        expect(isEmpty(Object.create(null))).toBe(true);
        expect(isEmpty(Object.assign(Object.create(null), { a: 1 }))).toBe(true);
    });
});

describe('isEmptyArray', () => {
    // Recursion happens through isEmpty(), so nested emptiness is transitive.
    test('recurses through nested arrays and objects', () => {
        expect(isEmptyArray([[], [{}]])).toBe(true);
        expect(isEmptyArray([[[]]])).toBe(true);
        expect(isEmptyArray(['  '])).toBe(true);
        expect(isEmptyArray([{ a: {} }])).toBe(true);
        expect(isEmptyArray([[], 0])).toBe(false);
        expect(isEmptyArray([1, [2]])).toBe(false);
        expect(isEmptyArray(['a'])).toBe(false);
        expect(isEmptyArray([null])).toBe(false);
        expect(isEmptyArray([undefined])).toBe(false);
    });

    // Any array-like value works: the loop reads `length` and indexes, so a Set
    // (length undefined) iterates zero times and reports empty.
    test('non-array inputs follow length/index access semantics', () => {
        expect(isEmptyArray({})).toBe(true);
        expect(isEmptyArray(new Set())).toBe(true);
        expect(isEmptyArray('')).toBe(true);
        expect(isEmptyArray('ab')).toBe(false);
    });

    // Reading `.length` of null/undefined throws — emptiness is not null-safe here.
    test('throws for null and undefined inputs', () => {
        expect(() => isEmptyArray(undefined)).toThrow(TypeError);
        expect(() => isEmptyArray(null)).toThrow(/Cannot read properties of (undefined|null)/);
    });
});

describe('isEmptyObject', () => {
    test('recurses through nested objects and arrays', () => {
        expect(isEmptyObject({ a: { b: { c: {} } } })).toBe(true);
        expect(isEmptyObject({ a: [{ b: '' }] })).toBe(true);
        expect(isEmptyObject({ a: { b: [] }, c: '' })).toBe(true);
        expect(isEmptyObject({ a: [0] })).toBe(false);
        expect(isEmptyObject({ a: { b: { c: 0 } } })).toBe(false);
        expect(isEmptyObject({ a: 'x' })).toBe(false);
        expect(isEmptyObject({ a: null })).toBe(false);
    });

    // Object.keys() drives the loop, so arrays enumerate indexes and a null-prototype
    // object enumerates its own keys normally.
    test('non-object inputs follow Object.keys semantics', () => {
        expect(isEmptyObject([])).toBe(true);
        expect(isEmptyObject([1])).toBe(false);
        expect(isEmptyObject('')).toBe(true);
        expect(isEmptyObject('ab')).toBe(false);
        expect(isEmptyObject(new Set())).toBe(true);
        expect(isEmptyObject(Object.create(null))).toBe(true);
        expect(isEmptyObject(Object.assign(Object.create(null), { a: '' }))).toBe(true);
        expect(isEmptyObject(Object.assign(Object.create(null), { a: 'x' }))).toBe(false);
    });

    // Object.keys(null/undefined) throws.
    test('throws for null and undefined inputs', () => {
        expect(() => isEmptyObject(undefined)).toThrow(TypeError);
        expect(() => isEmptyObject(null)).toThrow(/Cannot convert undefined or null to object/);
    });
});
