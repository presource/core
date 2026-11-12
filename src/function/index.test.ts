import * as functionModule from './index';
import { functionChain } from '@presource/core';

/**
 * src/function/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the nine `export *` lines in
 * src/function/index.ts (lines 6-14) and the runtime exports of each source file:
 *   ./chain   -> functionChain   (src/function/chain.ts:48)
 *   ./control -> functionControl (src/function/control.ts:27)
 *   ./curry   -> functionCurry   (src/function/curry.ts:27)
 *   ./delay   -> functionDelay   (src/function/delay.ts:17)
 *   ./options -> functionOptions (src/function/options.ts:44)
 *   ./pipe    -> functionPipe    (src/function/pipe.ts:33)
 *   ./proxy   -> functionProxy   (src/function/proxy.ts:32)
 *   ./queue   -> functionQueue   (src/function/queue.ts:49)
 *   ./state   -> functionState   (src/function/state.ts:30)
 *
 * FunctionControl / FunctionOptions (and the local `Callback`, `PipeReturn`, etc.) are
 * type-only exports and must not appear in the runtime key list.
 */
const EXPECTED_EXPORTS = [
    'functionChain',
    'functionControl',
    'functionCurry',
    'functionDelay',
    'functionOptions',
    'functionPipe',
    'functionProxy',
    'functionQueue',
    'functionState',
];

describe('function barrel (src/function/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(functionModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(functionModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(functionModule.functionChain).toBe(functionChain);
    });

    test('the re-exported functionPipe composes left-to-right (pipe.ts:33-46)', () => {
        // Extra args are forwarded to the first step only, so the second step sees `4`.
        const piped = functionModule.functionPipe(
            (value: number, multiplier: number) => value * multiplier,
            (value: number) => value + 1,
        );
        expect(piped(2, 2)).toBe(5);
        // Extra args reach only the first step; a second arg of 3 gives 1*3 then +1
        expect(piped(1, 3)).toBe(4);
    });

    test('the re-exported functionCurry still curries (curry.ts:27)', () => {
        const sum = functionModule.functionCurry((a: number, b: number, c: number) => a + b + c);
        expect((sum as any)(1)(2)(3)).toBe(6);
        expect((sum as any)(1, 2)(3)).toBe(6);
    });

    // --- pre-existing behavioural smoke check (kept from the original thin file) ---

    test('should export functionChain', () => {
        expect(functionChain).toBeInstanceOf(Function);
    });
});
