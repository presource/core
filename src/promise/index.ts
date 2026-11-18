/**
 * promise - Utility wrappers around native JavaScript Promises.
 * The barrel publishes one factory, `promiseCreate`, which creates a promise whose
 * `resolve`/`reject` are exposed on a caller-supplied control object so it can be
 * settled from outside. There is no exported constant: the code uses the native
 * `Promise` constructor directly.
 *
 * @module promise
 */

export * from './create';
