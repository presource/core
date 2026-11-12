import * as scriptModule from './index';
import { scriptChain, scriptAsync, scriptPause } from '@presource/core';

/**
 * src/script/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the four `export *` lines in
 * src/script/index.ts (lines 8-11) and the runtime exports of each source file:
 *   ./async   -> scriptAsync   (src/script/async.ts:65)
 *   ./chain   -> scriptChain   (src/script/chain.ts:60)
 *   ./pause   -> scriptPause   (src/script/pause.ts:17)
 *   ./resolve -> scriptResolve (src/script/resolve.ts:44)
 *
 * `ScriptAsync`, `ScriptChain`, `ScriptResolve`, `Configs`, `RelayObject`, `Callback`
 * are type-only exports and must not appear at runtime.
 */
const EXPECTED_EXPORTS = ['scriptAsync', 'scriptChain', 'scriptPause', 'scriptResolve'];

describe('script barrel (src/script/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(scriptModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(scriptModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(scriptModule.scriptChain).toBe(scriptChain);
        expect(scriptModule.scriptAsync).toBe(scriptAsync);
        expect(scriptModule.scriptPause).toBe(scriptPause);
    });

    test('the re-exported scriptPause resolves with undefined after the delay (pause.ts:17-26)', async () => {
        expect(await scriptModule.scriptPause(1)).toBeUndefined();
    });

    // --- pre-existing behavioural smoke checks (kept from the original thin file) ---

    test('should export scriptChain', () => {
        expect(scriptChain).toBeInstanceOf(Function);
    });

    test('should export scriptAsync', () => {
        expect(scriptAsync).toBeInstanceOf(Function);
    });

    test('should export scriptPause', () => {
        expect(scriptPause).toBeInstanceOf(Function);
    });
});
