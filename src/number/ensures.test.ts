import { numberEnsures } from './ensures';

/**
 * Contract source: `src/number/ensures.ts`.
 *
 * Two steps only: `value ? +value : 0` (falsy inputs short-circuit to 0 BEFORE coercion) and
 * `isNaN(result) ? 0 : result`. Consequences pinned below:
 *  - `-0` and `NaN` are falsy, so they return positive `0` without ever being coerced.
 *  - Non-finite results (`Infinity`) are NOT NaN, so they pass through unchanged.
 *  - `Symbol`, `BigInt` and prototype-less objects throw from unary `+` — the guard cannot catch
 *    them because the throw happens while evaluating `+value`.
 */
describe('numberEnsures', () => {
    test('should return a valid number', () => {
        expect(numberEnsures(123)).toBe(123);
        expect(numberEnsures('456')).toBe(456);
        expect(numberEnsures('12.34')).toBe(12.34);
    });

    test('should return 0 for invalid numbers', () => {
        expect(numberEnsures('abc')).toBe(0);
        expect(numberEnsures(null)).toBe(0);
        expect(numberEnsures(undefined)).toBe(0);
        expect(numberEnsures({})).toBe(0);
        expect(numberEnsures([])).toBe(0);
    });

    test('should return 0 for NaN', () => {
        expect(numberEnsures(NaN)).toBe(0);
    });

    test('should handle boolean values', () => {
        expect(numberEnsures(true)).toBe(1);
        expect(numberEnsures(false)).toBe(0);
    });

    test('should handle numeric string forms', () => {
        expect(numberEnsures('1e3')).toBe(1000);
        expect(numberEnsures('0x10')).toBe(16);
        expect(numberEnsures('0b11')).toBe(3);
        expect(numberEnsures('0o17')).toBe(15);
        expect(numberEnsures('+7')).toBe(7);
        expect(numberEnsures('-7')).toBe(-7);
        expect(numberEnsures('.5')).toBe(0.5);
        // Numeric strings tolerate surrounding whitespace of every kind.
        expect(numberEnsures('  12  ')).toBe(12);
        expect(numberEnsures('\n42\t')).toBe(42);
    });

    test('should return 0 for non-numeric and blank strings', () => {
        // `''` is falsy so it never reaches the coercion step.
        expect(numberEnsures('')).toBe(0);
        // `' '` and `'\t'` ARE truthy, so they coerce to 0 through `+' '`.
        expect(numberEnsures(' ')).toBe(0);
        expect(numberEnsures('\t')).toBe(0);
        expect(numberEnsures('5px')).toBe(0);
        expect(numberEnsures('true')).toBe(0);
        // Number('Infinity') is a legal numeric string literal, so it survives the NaN guard.
        expect(numberEnsures('Infinity')).toBe(Infinity);
        expect(numberEnsures('-Infinity')).toBe(-Infinity);
        expect(numberEnsures('12,000')).toBe(0);
    });

    test('should keep infinity unchanged because it is not NaN', () => {
        expect(numberEnsures(Infinity)).toBe(Infinity);
        expect(numberEnsures(-Infinity)).toBe(-Infinity);
        expect(numberEnsures('1e400')).toBe(Infinity);
    });

    // `-0` is falsy, so the ternary short-circuits and the signed zero is never preserved.
    test('should normalize negative zero to positive zero', () => {
        expect(numberEnsures(-0)).toBe(0);
        expect(Object.is(numberEnsures(-0), -0)).toBe(false);
        expect(Object.is(numberEnsures(-0), 0)).toBe(true);
        // A real negative number keeps its sign.
        expect(numberEnsures(-0.5)).toBe(-0.5);
    });

    test('should coerce single element arrays via their string form', () => {
        expect(numberEnsures([5])).toBe(5);
        expect(numberEnsures(['3'])).toBe(3);
        expect(numberEnsures([-2])).toBe(-2);
        expect(numberEnsures([[7]])).toBe(7);
        // Multi element arrays stringify with a comma and become NaN -> 0.
        expect(numberEnsures([1, 2])).toBe(0);
        expect(numberEnsures([NaN])).toBe(0);
    });

    test('should unwrap boxed number objects', () => {
        expect(numberEnsures(new Number(7))).toBe(7);
        // A boxed NaN object is truthy, coerces to NaN, and is normalized back to 0.
        expect(numberEnsures(new Number(NaN))).toBe(0);
    });

    test('should coerce dates and valueOf driven objects', () => {
        expect(numberEnsures(new Date('2020-01-01T00:00:00.000Z'))).toBe(1577836800000);
        expect(numberEnsures({ valueOf: () => 5 })).toBe(5);
        // valueOf returning a non-numeric string falls through to the object's default form (NaN -> 0).
        expect(numberEnsures({ valueOf: () => 'zz' })).toBe(0);
        // With no usable valueOf, unary plus falls back to toString and coerces that string.
        expect(numberEnsures({ toString: () => '8' })).toBe(8);
        // A RegExp stringifies to a pattern, which is not numeric.
        expect(numberEnsures(/a/)).toBe(0);
    });

    test('should throw for values unary plus cannot convert', () => {
        expect(() => numberEnsures(Symbol('s'))).toThrow(TypeError);
        expect(() => numberEnsures(Symbol('s'))).toThrow('Cannot convert a Symbol value to a number');
        expect(() => numberEnsures(2n)).toThrow('Cannot convert a BigInt value to a number');
        // Object.create(null) has no valueOf/toString on its prototype chain.
        expect(() => numberEnsures(Object.assign(Object.create(null), { a: 1 }))).toThrow(
            'Cannot convert object to primitive value',
        );
    });
});
