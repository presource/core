import * as loopModule from './index';
import { loopFor, loopWhile, loopUntil } from '@presource/core';

/**
 * src/loop/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the three `export *` lines in
 * src/loop/index.ts (lines 8-10) and the runtime exports of each source file:
 *   ./for   -> loopFor (for.ts:90), loopForAsync (for.ts:129)
 *   ./until -> loopUntil (until.ts:59)
 *   ./while -> loopWhile (while.ts:56)
 *
 * `Structure` / `StructureAsync` / `Callback` / `Condition` are type-only.
 */
const EXPECTED_EXPORTS = ['loopFor', 'loopForAsync', 'loopUntil', 'loopWhile'];

describe('loop barrel (src/loop/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(loopModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(loopModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(loopModule.loopFor).toBe(loopFor);
        expect(loopModule.loopWhile).toBe(loopWhile);
        expect(loopModule.loopUntil).toBe(loopUntil);
    });

    test('the re-exported loopFor still breaks early on a defined result (for.ts:90-104)', () => {
        const seen: number[] = [];
        const result = loopModule.loopFor(3, ({ index }) => {
            seen.push(index);
            return index === 2 ? 'done' : undefined;
        });
        expect(result).toBe('done');
        expect(seen).toStrictEqual([0, 1, 2]);
        // Zero iterations never invoke the callback and yield undefined
        expect(loopModule.loopFor(0, () => 'never')).toBeUndefined();
    });

    test('the re-exported loopForAsync resolves the same result (for.ts:129+)', async () => {
        expect(await loopModule.loopForAsync(2, async ({ index }) => (index === 1 ? 'async-done' : undefined)))
            .toBe('async-done');
    });

    // --- pre-existing behavioural smoke checks (kept from the original thin file) ---

    test('should export loopFor', () => {
        expect(loopFor).toBeInstanceOf(Function);
    });

    test('should export loopWhile', () => {
        expect(loopWhile).toBeInstanceOf(Function);
    });

    test('should export loopUntil', () => {
        expect(loopUntil).toBeInstanceOf(Function);
    });
});
