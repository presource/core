/**
 * Object flatten utility.
 *
 * Converts a nested object into a single-level object with dot-separated keys.
 */
import { isObject } from '../is';
import { objectScan } from './scan';

/** Arguments passed to the flatten callback. */
type Arguments = {
  /** The property key. */
  key: string | number;
  /** The property value. */
  value: any;
  /** The object being scanned. */
  object: { [key: string]: any };
  /** Zero-based index among sibling properties. */
  index: number;
  /** Total number of sibling properties. */
  length: number;
  /** Path from the root to the current property. */
  path: string[];
};

/** Optional callbacks to customise the flattened key and value output. */
type Callback = {
  /**
   * Returns a custom key for the flattened entry. Receives the full scan `Arguments`
   * payload. Any falsy result falls back to the joined path (flatten.ts:77 `||`).
   */
  key?: (args: Arguments) => string;
  /**
   * Returns a custom value for the flattened entry.
   *
   * NOTE: at runtime this receives the raw leaf value, NOT the `Arguments` object the
   * `key` callback receives (flatten.ts:78 passes `value` only). The parameter type is
   * kept as-is for API compatibility. Any falsy result (0, '', false, null, undefined)
   * is discarded in favour of the original leaf value, so a value callback can never
   * flatten a leaf to a falsy value.
   */
  value?: (args: Arguments) => string;
};

type Structure = (object: { [key: string]: any }, callback?: Callback) => { [key: string]: any };

/**
 * Flattens a nested object into a single-level object with dot-separated keys.
 *
 * Uses `objectScan` to walk the tree and collects leaf (non-object) values under
 * a key that is the join of the path segments. Optional callbacks allow overriding
 * the generated key and value.
 *
 * @param object - The object to flatten.
 * @param callback - Optional `{ key, value }` callbacks to customise output.
 * @returns A flat object with dot-notation keys.
 */
export const objectFlatten: Structure = (object, callback) => {
  const result: { [key: string]: any } = {};
  // Using Object Scan function
  objectScan(object, (data) => {
    // Extracting the Data
    const { value, key, path } = data;
    // Checking Whether value is an object or not. Objects are only walked through, never
    // emitted as entries, so a branch that holds no leaf at all (e.g. `{ a: {} }`) vanishes
    // from the flattened result entirely - flatten/unflatten round-trips are lossy there.
    if (!isObject(value)) {
      // value must not be an object
      // Adding the Current Key to the Path
      if (key) {
        // Only if key is a valid. Empty string are not counted
        path.push(key as string);
      }

      // Converting Key and Value. Both use `||`, so a falsy callback result falls back to the
      // default: the `key` callback receives the scan Arguments object, while the `value`
      // callback receives only the raw leaf value (see the Callback.value note above).
      const newKey = callback?.key?.(data) || path.join('.');
      const newValue = callback?.value?.(value) || value;
      // Updating the Result with Path
      result[newKey] = newValue;
    }
  });

  // Returning the Final Result
  return result;
};
