import * as promiseModule from './index';
import { promiseCreate } from '@presource/core';

/**
 * src/promise/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the single `export *` line in
 * src/promise/index.ts (line 9): promiseCreate (src/promise/create.ts:14).
 * Despite the module docstring mentioning a "centralized constant", no constant is
 * exported — the native Promise constructor is used directly.
 */
const EXPECTED_EXPORTS = ['promiseCreate'];

describe('promise barrel (src/promise/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(promiseModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(promiseModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(promiseModule.promiseCreate).toBe(promiseCreate);
    });

    test('the re-exported promiseCreate exposes resolve/reject on the control object (create.ts:14-21)', async () => {
        const control: { resolve?: (value: number) => void; reject?: (reason: any) => void } = {};
        const promise = promiseModule.promiseCreate(control);
        expect(promise).toBeInstanceOf(Promise);
        expect(Object.keys(control).sort()).toStrictEqual(['reject', 'resolve']);
        expect(typeof control.resolve).toBe('function');
        expect(typeof control.reject).toBe('function');
        control.resolve?.(7);
        expect(await promise).toBe(7);
    });

    test('the control argument defaults to an internal object', () => {
        // With no control object supplied the resolve/reject pair is captured inside the
        // promise (create.ts:14 default `{}`), so nothing external can settle it: assert
        // only that construction succeeds and yields a Promise (never await it here).
        const promise = promiseModule.promiseCreate();
        expect(promise).toBeInstanceOf(Promise);
        expect(typeof (promise as any).then).toBe('function');
    });
});
