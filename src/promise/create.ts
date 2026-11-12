/**
 * Creates a new Promise instance and exposes its `resolve` and `reject`
 * callbacks on the provided `control` object.
 *
 * This allows external code to resolve or reject the promise at a later
 * time by calling `control.resolve(value)` or `control.reject(reason)`.
 *
 * @param control - An object that will be augmented with `resolve` and
 *                  `reject` functions. If not provided, an empty object
 *                  is used by default.
 * @returns A new Promise instance whose fate is controlled through the
 *          `control` object.
 */
export const promiseCreate = (control: any = {}) =>
    new Promise((resolve: any, reject: any) => {
        // Attach resolve/reject to the control object so callers can
        // settle the promise externally after this function returns.
        control.resolve = resolve;
        control.reject = reject;
    });
