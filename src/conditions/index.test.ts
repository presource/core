import * as conditionsModule from './index';
import { ifThen } from '@presource/core';

/**
 * src/conditions/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the two `export *` lines in
 * src/conditions/index.ts (lines 8-9) and the runtime exports of each source file:
 *   ./if  -> ifTrue  (src/conditions/if.ts:21)
 *          -> ifFalse (src/conditions/if.ts:35)
 *   ./then -> ifThen (src/conditions/then.ts:30)
 *
 * `Condition` / `Callback` in then.ts are type-only and never appear at runtime.
 */
const EXPECTED_EXPORTS = ['ifFalse', 'ifThen', 'ifTrue'];

describe('conditions barrel (src/conditions/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(conditionsModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(conditionsModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(conditionsModule.ifThen).toBe(ifThen);
    });

    test('the re-exported implementations still behave', () => {
        // ifTrue / ifFalse coerce through `!!` and return the callback result, or
        // undefined when the branch does not match (if.ts:21-45).
        expect(conditionsModule.ifTrue('x')).toBe(true);
        expect(conditionsModule.ifTrue('')).toBeUndefined();
        expect(conditionsModule.ifFalse('')).toBe(true);
        expect(conditionsModule.ifFalse('x')).toBeUndefined();
        expect(conditionsModule.ifTrue(1, ({ value }) => `value:${value}`)).toBe('value:1');
        // ifThen hands the callback to the condition, then runs the callback (then.ts:30)
        expect(conditionsModule.ifThen(() => true, () => 'ran')).toBe('ran');
        expect(conditionsModule.ifThen(() => false, () => 'ran')).toBeUndefined();
    });

    // --- pre-existing behavioural smoke check (kept from the original thin file) ---

    test('should export ifThen', () => {
        expect(ifThen).toBeInstanceOf(Function);
    });
});
