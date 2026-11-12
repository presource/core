import { toString } from '@presource/core';

describe('js/to/toString', () => {
    test('Converting primitives to string', () => {
        expect(toString(1)).toBe('1');
        expect(toString(null)).toBe('null');
        expect(toString(undefined)).toBe('undefined');
        // Empty is not the same as inputing undefined!
        expect(toString()).toBe('');
    });

    test('Converting objects to string', () => {
        // Array Testing
        expect(toString([])).toBe('[]');
        expect(toString([1, 2, 3])).toBe('[1,2,3]');

        // Object Testing
        expect(toString({})).toBe('{}');
        expect(toString({ a: 1, b: 2, c: 3 })).toBe('{"a":1,"b":2,"c":3}');

        // Function Testing using arrow function
        expect(toString(() => {})).toBe('() => {}');
        // Old Function Format
        const test = function () {};
        expect(toString(test)).toBe('function() {}');
    });

    // Advance Usage
    test('Multiple conversion', () => {
        const convert = [1, [], 'hi'];
        expect(toString(...convert)).toStrictEqual(['1', '[]', 'hi']);
    });

    // ------------------------------------------------------------------
    // Single-value conversion: typeSwitch routes object/array/null/undefined to
    // JSON.stringify (or sentinel strings); everything else uses its own toString().
    // ------------------------------------------------------------------
    test('single-value conversion for every primitive', () => {
        expect(toString(0)).toBe('0');
        expect(toString(-0)).toBe('0');
        expect(toString(-1.5)).toBe('-1.5');
        expect(toString(NaN)).toBe('NaN');
        expect(toString(Infinity)).toBe('Infinity');
        expect(toString(-Infinity)).toBe('-Infinity');
        expect(toString(true)).toBe('true');
        expect(toString(false)).toBe('false');
        expect(toString('')).toBe('');
        expect(toString('plain')).toBe('plain');
        expect(toString(10n)).toBe('10');
        expect(toString(0n)).toBe('0');
        expect(toString(Symbol('x'))).toBe('Symbol(x)');
        expect(toString(Symbol.iterator)).toBe('Symbol(Symbol.iterator)');
    });

    // Boxed primitives report number/string/boolean type names, so the default branch
    // calls their intrinsic toString().
    test('single-value conversion for boxed primitives', () => {
        expect(toString(new Number(5))).toBe('5');
        expect(toString(new String('q'))).toBe('q');
        expect(toString(new Boolean(true))).toBe('true');
        expect(toString(new Boolean(false))).toBe('false');
    });

    // Objects and arrays are JSON-stringified, so JSON semantics apply verbatim.
    test('objects and arrays use JSON.stringify semantics', () => {
        expect(toString({ a: undefined, b: function () {}, c: Symbol('s') })).toBe('{}');
        expect(toString([{ a: 1 }])).toBe('[{"a":1}]');
        expect(toString([1, [2, { a: 3 }], 'x'])).toBe('[1,[2,{"a":3}],"x"]');
        // undefined entries inside an array become null, functions/symbols are dropped
        expect(toString([null, undefined, false, 0, ''])).toBe('[null,null,false,0,""]');
        expect(toString({ nested: { list: [1, 'a', null] } })).toBe('{"nested":{"list":[1,"a",null]}}');
        expect(toString({ toString: null })).toBe('{"toString":null}');
    });

    // Built-ins report non-JSON type names and fall through to `value.toString()`.
    test('built-in objects fall back to their own toString', () => {
        expect(toString(new Map([['a', 1]]))).toBe('[object Map]');
        expect(toString(new Set([1]))).toBe('[object Set]');
        expect(toString(Promise.resolve(1))).toBe('[object Promise]');
        expect(toString(/ab/g)).toBe('/ab/g');
        expect(toString(new Error('boom'))).toBe('Error: boom');
        // Error subclasses inherit Error.prototype.toString, which prints "Error: msg"
        class Boom extends Error {}
        expect(toString(new Boom('z'))).toBe('Error: z');
        // Date output is locale/timezone dependent, so compare against the platform string
        expect(toString(new Date(0))).toBe(new Date(0).toString());
    });

    // User classes get their own toString(); an OWN-PROPERTY toString function is instead
    // dropped by JSON.stringify because the value routes through the `object` case.
    test('class instances use their toString while object literals ignore theirs', () => {
        class Point {
            x = 1;
            toString() {
                return 'POINT:1';
            }
        }
        expect(toString(new Point())).toBe('POINT:1');
        expect(toString({ toString: () => 'CUSTOM' })).toBe('{}');
    });

    // Math's constructor is Object, so it routes to the JSON branch instead of "[object Math]".
    // A null-prototype object has no constructor, so typeSwitch treats it as null => 'null'.
    test('quirks: Math serialises as an object and null-prototype objects as "null"', () => {
        expect(toString(Math)).toBe('{}');
        expect(toString(Object.create(null))).toBe('null');
        expect(toString(Object.assign(Object.create(null), { a: 1 }))).toBe('null');
    });

    // ------------------------------------------------------------------
    // Multiple arguments: the dispatcher returns an ARRAY of converted values,
    // even though the declared return type is `string` (documented quirk).
    // ------------------------------------------------------------------
    test('multiple arguments return an array of converted strings', () => {
        const pair: unknown = toString(1, 2);
        expect(pair).toStrictEqual(['1', '2']);

        const triple: unknown = toString('a', 'b', 'c');
        expect(triple).toStrictEqual(['a', 'b', 'c']);
        expect(triple).toHaveLength(3);

        const mixed: unknown = toString(1, null, undefined, []);
        expect(mixed).toStrictEqual(['1', 'null', 'undefined', '[]']);

        const structured: unknown = toString({ a: 1 }, [1], null);
        expect(structured).toStrictEqual(['{"a":1}', '[1]', 'null']);

        const bigints: unknown = toString(10n, 20n);
        expect(bigints).toStrictEqual(['10', '20']);

        const repeated: unknown = toString(undefined, undefined);
        expect(repeated).toStrictEqual(['undefined', 'undefined']);

        // Two arguments is already enough to leave the string branch
        const single: unknown = toString('a');
        expect(single).toBe('a');
    });

    // Circular structures hit JSON.stringify, so the conversion throws (no safe fallback).
    test('circular structures throw a TypeError from JSON.stringify', () => {
        const circular: any = { name: 'loop' };
        circular.self = circular;
        expect(() => toString(circular)).toThrow(TypeError);
        expect(() => toString(circular)).toThrow(/Converting circular structure to JSON/);
        expect(() => toString([circular])).toThrow(/Converting circular structure to JSON/);
    });
});

/**
 * Perf-wave contract pins for the single-scalar fast path (T-A).
 *
 * `toString` short-circuits `string` / `number` / `boolean` / `null` / `undefined`
 * for a single argument instead of routing them through `stringSwitch` +
 * `typeSwitch` (measured 35x for `toString(42)`). `String()` produces exactly what
 * the old `typeSwitch` fallback produced for those five inputs - the sentinel
 * strings included - so only the cost changed.
 *
 * Everything else still takes the original path and is pinned here: boxed
 * primitives keep their own `toString()`, bigint / symbol / function keep routing
 * through `typeSwitch`, objects and arrays stay JSON-stringified, and the documented
 * multi-argument quirk (the `stringSwitch` default branch maps every argument, so
 * the RESULT IS AN ARRAY even though the signature says `string`) is untouched.
 */
describe('toString single-scalar fast path', () => {
    test('Scalars match String() exactly', () => {
        for (const scalar of [42, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 'x', '', true, false] as any[]) {
            expect(toString(scalar)).toBe(String(scalar));
        }
    });

    test('Null and undefined still produce the sentinel strings', () => {
        expect(toString(null)).toBe('null');
        expect(toString(undefined)).toBe('undefined');
    });

    test('Boxed primitives keep using their own toString', () => {
        expect(toString(Object(42))).toBe('42');
        expect(toString(Object('x'))).toBe('x');
    });

    test('BigInt, symbol and function inputs keep routing through the type dispatcher', () => {
        expect(toString(10n)).toBe('10');
        expect(toString(Symbol('sym'))).toBe('Symbol(sym)');
        expect(toString(function named() {})).toBe('function named() {}');
    });

    test('Objects and arrays stay JSON-stringified, nested included', () => {
        expect(toString({ a: [1, { b: 2 }] })).toBe('{"a":[1,{"b":2}]}');
    });

    test('The multi-argument array quirk is unchanged', () => {
        expect(toString(1 as any, 2 as any)).toEqual(['1', '2']);
        expect(toString('a' as any, null as any)).toEqual(['a', 'null']);
    });
});
