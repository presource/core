/**
 * Object scan utility.
 *
 * Recursively traverses an object and its nested sub-objects, invoking a
 * callback for each property. The callback may return a replacement value
 * to mutate the object in place.
 */
import { isObject } from '../is';
import { toString } from '../to';
import { objectEach } from './each';

/** Arguments passed to the scan callback. */
type Arguments = {
  /** The property key. */
  key: string | number;
  /** The property value. */
  value: any;
  /** The object being scanned. */
  object: { [key: string]: any };
  /** The zero-based index among sibling properties. */
  index: number;
  /** The total number of sibling properties. */
  length: number;
  /** The array of key segments from the scan root down to the current property. */
  path: string[];
};

/** Callback invoked for each property during the scan. Return a value to replace the current property. */
type Callback = (args: Arguments) => any;

/** Internal state passed through recursive calls to track the current path. */
type Recursive = {
  /** The chain of keys from root to current level. */
  path: string[];
};

type Structure = (object: { [key: string]: any }, callback: Callback, recursive?: Recursive) => void;

/**
 * Deeply scans an object, invoking a callback for each property and its nested descendants.
 *
 * If the callback returns a non-undefined value, the current property is replaced.
 * Descendant objects are only recursed into while the callback has NOT replaced their
 * value, so replacing on the way in breaks a cyclic chain (pinned by "A non-undefined
 * return replaces the value in place and stops recursion for that subtree" in
 * src/object/scan.test.ts). No seen-set is tracked: cyclic data the callback leaves alone
 * (`a.self = a`) still re-enters until the stack overflows — the earlier wording of this
 * paragraph promised cycle protection the guard does not give, which is why that cycle
 * test is still named after the claim.
 *
 * @param object - The object to scan (mutated in place if the callback returns replacements).
 * @param callback - Invoked for every property; may return a replacement value.
 * @param recursive - Internal state tracking the traversal path. Defaults to `{ path: [] }`.
 */
export const objectScan: Structure = (object, callback, recursive = { path: [] }) => {
  // `objectEach` is the walker; its payload is copied and extended with `path` below
  objectEach(object, (data) => {
    // Extracting the value and key
    const { value, key } = data;
    const path = recursive.path.slice();

    const params = { ...data, path };

    // Replacement for the value (if necessary)
    const replacement = callback(params);

    // A defined return value is a replacement; undefined means "leave it alone"
    if (replacement !== undefined) {
      object[key] = replacement;
    }

    // Only descend when the callback did NOT replace this property. A replacement is often a
    // freshly built (or parent-pointing) value, so re-entering it risks an unbounded recursion.
    if (value === object[key] && isObject(value)) {
      // Unchanged and still a plain object: safe to descend
      const newPath = [...path];
      newPath.push(toString(key));
      // Descend into the nested object with the SAME callback and the extended path
      objectScan(value, callback, { path: newPath });
    }
  });
};
