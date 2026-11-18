/**
 * Object resolve utility.
 *
 * Intended to resolve function-valued properties within an object.
 * (Currently a stub that iterates but returns an empty object.)
 */
import { objectEach } from './each';

type Item = { [key: string]: any };

type Structure = (input: Item) => Item;

/**
 * Iterates over each property key in the input object.
 *
 * @param data - The object whose keys to iterate.
 * @returns An empty object (stub implementation).
 */
export const objectResolve: Structure = (data) => {
  const result: Item = {};

  const resolveValue = (key: string, value: any) => {
    // TODO: pending - Resolving function-valued properties is unimplemented: this helper hands
    // back its key and nothing is ever written into `result`, so the call always yields an empty
    // object even though the iteration below really runs (stub is still exported from the barrel).
    return key;
  };

  objectEach(data, ({ key, value }: any) => {
    // The iteration is the only observable work the stub does: every own key is visited and
    // handed to `resolveValue`, whose return value is discarded.
    resolveValue(key, value);
  });

  return result;
};
