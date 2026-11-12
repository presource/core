import * as stringModule from './index';
import { stringCapitalize, stringIncludes, stringReverse, stringSwitch, stringSwitchAsync } from '@presource/core';

/**
 * src/string/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the four `export *` lines in
 * src/string/index.ts (lines 8-11) and the runtime exports of each source file:
 *   ./capitalize -> stringCapitalize    (src/string/capitalize.ts:19)
 *   ./includes   -> stringIncludes      (src/string/includes.ts:54)
 *   ./reverse    -> stringReverse       (src/string/reverse.ts:14)
 *   ./switch     -> stringSwitch        (src/string/switch.ts:76)
 *                 -> stringSwitchAsync  (src/string/switch.ts:93)
 *
 * `Structure` / `Cases` (switch.ts, includes.ts) are type-only.
 */
const EXPECTED_EXPORTS = [
    'stringCapitalize',
    'stringIncludes',
    'stringReverse',
    'stringSwitch',
    'stringSwitchAsync',
];

describe('string barrel (src/string/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(stringModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(stringModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(stringModule.stringCapitalize).toBe(stringCapitalize);
        expect(stringModule.stringIncludes).toBe(stringIncludes);
        expect(stringModule.stringReverse).toBe(stringReverse);
        expect(stringModule.stringSwitch).toBe(stringSwitch);
        expect(stringModule.stringSwitchAsync).toBe(stringSwitchAsync);
    });

    test('the re-exported helpers still behave (capitalize.ts:19 / reverse.ts:14)', () => {
        // Default index 0 capitalizes the first character of every space-separated word
        expect(stringModule.stringCapitalize('hello world')).toBe('Hello World');
        // Explicit index targets that position within each word
        expect(stringModule.stringCapitalize('abc', 1)).toBe('aBc');
        expect(stringModule.stringReverse('abc')).toBe('cba');
        expect(stringModule.stringReverse('')).toBe('');
    });

    test('the re-exported stringIncludes returns only the matched keys (includes.ts:54-71)', () => {
        expect(stringModule.stringIncludes('hello world', { ell: 'matched', zzz: 'unmatched' }))
            .toStrictEqual({ ell: 'matched' });
        // No matches at all is an empty object, not undefined
        expect(stringModule.stringIncludes('abc', { xyz: 1 })).toStrictEqual({});
    });

    test('the re-exported string switch dispatchers resolve static and callback cases (switch.ts:76-101)', async () => {
        expect(stringModule.stringSwitch('a', { a: 1, default: 2 })).toBe(1);
        expect(stringModule.stringSwitch('z', { a: 1, default: 2 })).toBe(2);
        expect(stringModule.stringSwitch('a', { a: ({ value }: any) => `${value}!` })).toBe('a!');
        expect(await stringModule.stringSwitchAsync('b', { b: async ({ value }: any) => value.toUpperCase(), default: () => 'x' }))
            .toBe('B');
        expect(await stringModule.stringSwitchAsync('z', { b: () => 'y', default: 'fallback' })).toBe('fallback');
    });
});
