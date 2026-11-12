/**
 * Wrapper `get` method implementation.
 *
 * Retrieves a subset of the wrapped array's elements based on a key selection request.
 * Always returns a new array (not a reference to the original).
 */

import { Params } from '..';
import { keysFunction } from './keys';

/**
 * Signature for the get method handler.
 * Receives wrapper params and a filter request, returns matching elements.
 */
type GetFunction = (params: Params, request: Parameters<typeof keysFunction>[1]) => any[];

/**
 * Retrieves elements from the wrapped array matching the given request.
 *
 * Delegates to `keys` to find matching indexes, then maps those indexes
 * to actual values. Returns a new array to avoid reference leaks.
 *
 * @param params - The wrapper parameter object.
 * @param request - The filter criteria passed to `keys`.
 * @returns A new array containing the matched elements.
 */
export const getFunction: GetFunction = (params, request) => {
  const { element, instance } = params;
  // First resolve which indexes match the request
  const result = instance.keys(request);
  // Map matching indexes to their corresponding values, producing a fresh array
  return result.map((index: number) => element[index]);
};
