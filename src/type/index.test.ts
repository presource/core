import * as typeModule from './index';
import { typeConstructor, typeName } from '@presource/core';

/**
 * src/type/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the four `export *` lines in
 * src/type/index.ts (lines 8-11) and the runtime exports of each source file:
 *   ./constructor    -> typeConstructor  (src/type/constructor.ts:9)
 *   ./name           -> typeName         (src/type/name.ts:14)
 *   ./switch         -> typeSwitch       (src/type/switch.ts:81)
 *   ./switchAsync    -> typeSwitchAsync  (src/type/switchAsync.ts:92)
 *
 * `TypeSwitch` / `TypeSwitchAsync` / `Cases` are type-only exports.
 */
const EXPECTED_EXPORTS = ['typeConstructor', 'typeName', 'typeSwitch', 'typeSwitchAsync'];

describe('type barrel (src/type/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(typeModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(typeModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(typeModule.typeConstructor).toBe(typeConstructor);
        expect(typeModule.typeName).toBe(typeName);
    });

    test('the re-exported switch dispatchers resolve cases exactly (switch.ts:81+)', async () => {
        expect(typeModule.typeSwitch('x', { string: ({ value }: any) => `string:${value}`, default: () => 'other' }))
            .toBe('string:x');
        // A non-function case value is returned raw (switch.ts:103)
        expect(typeModule.typeSwitch(1, { number: 'raw-number', default: 'other' })).toBe('raw-number');
        // null / undefined have no constructor; the '' fallback maps them to their names
        expect(typeModule.typeSwitch(null, { null: () => 'is-null', default: () => 'other' })).toBe('is-null');
        expect(typeModule.typeSwitch(undefined, { undefined: () => 'is-undefined', default: () => 'other' }))
            .toBe('is-undefined');
        expect(typeModule.typeSwitch(Symbol(), { default: 'fallback' })).toBe('fallback');
        expect(await typeModule.typeSwitchAsync([1], { array: () => 'is-array', default: () => 'other' }))
            .toBe('is-array');
    });

    // --- pre-existing behavioural smoke checks (kept from the original thin file) ---

    test('should export typeConstructor', () => {
        expect(typeConstructor).toBeInstanceOf(Function);
        expect(typeConstructor('test')).toBe(String);
    });

    test('should export typeName', () => {
        expect(typeName).toBeInstanceOf(Function);
        expect(typeName('test')).toBe('string');
    });
});
