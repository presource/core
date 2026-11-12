import { isPromise, promiseCreate } from '@presource/core';

/**
 * Contract source: `src/promise/create.ts`.
 *
 * `promiseCreate(control = {})` builds a Promise whose executor assigns `resolve`/`reject` onto
 * `control` SYNCHRONOUSLY (create.ts:15-20), so the returned promise is still pending but already
 * externally settle-able when the call returns.
 *
 * Notes pinned below:
 *  - The default `{}` only applies to `undefined`; a `null` control makes the assignment throw,
 *    and because the throw happens inside the executor the promise comes back REJECTED.
 *  - Later `resolve`/`reject` calls are ignored once settled (native promise semantics).
 *  - Re-using one control for two calls overwrites the handlers, so only the newest promise can
 *    be settled through it.
 */

/**
 * Resolves to the settled state of a promise, or the PENDING sentinel when it has not settled.
 * The fallback uses a real macrotask timer so that an already-settled promise (which resolves in
 * a microtask) always wins the race deterministically.
 */
const PENDING = { status: 'pending' };
const settle = async (promise: Promise<unknown>): Promise<any> => {
    return Promise.race([
        promise.then(
            (value) => ({ status: 'fulfilled', value }),
            (reason) => ({ status: 'rejected', reason: String(reason) }),
        ),
        new Promise((resolveState) => setTimeout(() => resolveState(PENDING), 0)),
    ]);
};

describe('Create promise', () => {
    test('Promise created successfully', () => {
        const control: any = {};
        const promise = promiseCreate(control);

        expect(control.resolve).not.toBeUndefined();
        expect(control.reject).not.toBeUndefined();
    });

    test('should attach resolve and reject synchronously as functions', () => {
        const control: any = {};
        const promise = promiseCreate(control);

        // No await: the executor of `new Promise` runs synchronously, so the handlers exist now.
        expect(typeof control.resolve).toBe('function');
        expect(typeof control.reject).toBe('function');
        expect(Object.keys(control)).toStrictEqual(['resolve', 'reject']);
        expect(promise instanceof Promise).toBe(true);
        expect(isPromise(promise)).toBe(true);
    });

    test('should stay pending until the control settles it', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        expect(await settle(promise)).toBe(PENDING);

        control.resolve('done');
        expect(await promise).toBe('done');
        expect(await settle(promise)).toStrictEqual({ status: 'fulfilled', value: 'done' });
    });

    test('should work with the default empty control argument', async () => {
        const promise = promiseCreate();

        expect(promise instanceof Promise).toBe(true);
        // With no control reference there is nothing to settle it, so it stays pending.
        expect(await settle(promise)).toBe(PENDING);
    });

    test('should settle with the value passed to resolve', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        control.resolve({ a: 1 });
        expect(await promise).toStrictEqual({ a: 1 });
    });

    test('should settle with undefined when resolve is called without arguments', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        control.resolve();
        expect(await promise).toBeUndefined();
    });

    // A thenable resolution is adopted by the native promise, not stored verbatim.
    test('should adopt a thenable passed to resolve', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        control.resolve(Promise.resolve('thened'));
        expect(await promise).toBe('thened');
    });

    test('should reject with the reason passed to reject', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        control.reject('boom');
        expect(await settle(promise)).toStrictEqual({ status: 'rejected', reason: 'boom' });
        await expect(promise).rejects.toBe('boom');
    });

    // First settlement wins; every later call is a no-op (native promise behaviour).
    test('should ignore a second resolve after the first one', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        control.resolve('first');
        control.resolve('second');
        control.reject('third');

        expect(await promise).toBe('first');
    });

    test('should ignore resolve and reject after the promise is rejected', async () => {
        const control: any = {};
        const promise = promiseCreate(control);

        control.reject('r1');
        control.resolve('r2');
        control.reject('r3');

        await expect(promise).rejects.toBe('r1');
    });

    test('should keep pre-existing control properties intact', () => {
        const nested = { a: 1 };
        const control: any = { existing: 'kept', nested, resolve: 'overwritten' };
        const promise = promiseCreate(control);

        expect(control.existing).toBe('kept');
        expect(control.nested).toBe(nested);
        // The previous non-function `resolve` value is replaced by the real handler.
        expect(typeof control.resolve).toBe('function');
        expect(promise instanceof Promise).toBe(true);
    });

    test('should deliver the externally resolved value through a then chain', async () => {
        const control: any = {};
        const promise = promiseCreate(control);
        const chained = promise.then((value) => `wrapped:${value}`);

        control.resolve('x');
        expect(await chained).toBe('wrapped:x');
    });

    test('should propagate an external rejection through catch', async () => {
        const control: any = {};
        const promise = promiseCreate(control);
        const recovered = promise.catch((reason) => `caught:${reason}`);

        control.reject('fail');
        expect(await recovered).toBe('caught:fail');
    });

    // A reused control keeps only the newest handlers, so only the second promise settles.
    test('should let the newest promise win when one control is reused', async () => {
        const control: any = {};
        const first = promiseCreate(control);
        const second = promiseCreate(control);

        control.resolve('newest');

        expect(await second).toBe('newest');
        expect(await settle(first)).toBe(PENDING);
    });

    test('should attach handlers to a non-object control container such as an array', async () => {
        const control: any = [];
        const promise = promiseCreate(control);

        // Named properties on an array do not change its length.
        expect(Object.keys(control)).toStrictEqual(['resolve', 'reject']);
        expect(control.length).toBe(0);

        control.resolve('array');
        expect(await promise).toBe('array');
    });

    // `control: any = {}` only defaults on undefined, so null reaches the assignment and throws
    // inside the executor, which surfaces as a rejected promise rather than a thrown call.
    test('should return a rejected promise when the control is null', async () => {
        const promise = promiseCreate(null);

        expect(promise instanceof Promise).toBe(true);
        const outcome = await settle(promise);
        expect(outcome.status).toBe('rejected');
        expect((outcome as any).reason).toContain('Cannot set properties of null');
    });

    // Explicit undefined still triggers the default parameter, matching the no-argument call.
    test('should fall back to a fresh control when undefined is passed explicitly', async () => {
        const control: any = undefined;
        const promise = promiseCreate(control);

        expect(promise instanceof Promise).toBe(true);
        expect(await settle(promise)).toBe(PENDING);
    });
});
