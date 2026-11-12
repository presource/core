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
  /** The dot-segment path from the root to the current property. */
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
 * Descendant objects are only recursed into when the property value has not been
 * replaced, preventing infinite loops on circular re-assignments.
 *
 * @param object - The object to scan (mutated in place if the callback returns replacements).
 * @param callback - Invoked for every property; may return a replacement value.
 * @param recursive - Internal state tracking the traversal path. Defaults to `{ path: [] }`.
 */
export const objectScan: Structure = (object, callback, recursive = { path: [] }) => {
  // Using Special Object Each as Based Scanner
  objectEach(object, (data) => {
    // Extracting the value and key
    const { value, key } = data;
    const path = recursive.path.slice();

    const params = { ...data, path };

    // Replacement for the value (if necessary)
    const replacement = callback(params);

    // Checking if Replacement is a value
    if (replacement !== undefined) {
      // If Replacement is Not Undefined
      object[key] = replacement;
    }

    // Checking whether object[key] is still value
    // Do not continue with replacement due to possible recursive loop
    if (value === object[key] && isObject(value)) {
      // If it is, then continue
      const newPath = [...path];
      // Adding Key to New Path
      newPath.push(toString(key));
      // Scanning the nested value with new callback
      objectScan(value, callback, { path: newPath });
    }
  });
};
