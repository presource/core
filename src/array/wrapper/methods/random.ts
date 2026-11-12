/**
 * Wrapper `random` method implementation.
 *
 * Returns a randomly selected element from the wrapped array.
 */

import { Params } from '..';

/**
 * Signature for the random method handler.
 */
type RandomFunction = (params: Params) => any;

/**
 * Returns a single randomly chosen element from the wrapped array.
 *
 * Uses uniform random selection across all indexes.
 * Empty arrays yield `undefined` because `element[0]` is absent — callers of a
 * potentially empty wrapper must null-check the result.
 *
 * @param params - The wrapper parameter object.
 * @returns A random element from the underlying array.
 */
export const randomFunction: RandomFunction = (params) => {
    const { element } = params;
    const index = Math.floor(Math.random() * element.length);

    return element[index];
};
