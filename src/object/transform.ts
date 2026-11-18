/**
 * Object transform utility.
 *
 * Applies a set of transformation rules to an input object, supporting
 * nested transforms and dependency resolution via iterative passes.
 */
import { isObject } from '../is';
import { typeSwitch } from '../type';
import { objectEach } from './each';
import { objectHasKey } from './has';

type Item = { [key: string]: any };

/** Arguments passed to each transform callback. */
type Arguments = {
  /** The property key being transformed. */
  key: string;
  /** The original value for the key. */
  value: any;
  /** The input object. */
  input: Item;
  /** The output object being built. */
  output: Item;
};

/** A transform callback that receives one or more argument snapshots. */
type Callback = (...args: Arguments[]) => any;

/** A map from property keys to their transform rules (primitives, callbacks, or nested transformer maps). */
type Transformers = { [key: string]: string | number | boolean | Callback | Transformers };

type Structure = (input: Item, transforms: Transformers, layers?: Arguments[]) => Item;

/**
 * Transforms an input object according to a set of transformer rules.
 *
 * Processes keys in iterative passes until no more transforms are pending.
 * Supports nested transforms (object-valued rules) and function callbacks
 * that receive the current state plus any accumulated `layers`.
 *
 * @param input - The object to transform.
 * @param transformers - A map of keys to their transform rules.
 * @param layers - Ancestor snapshots carried into a nested transform; a callback receives
 *        this level's snapshot first, then these.
 * @returns A new object with the transformed values.
 */
export const objectTransform: Structure = (input, transformers, layers = []) => {
  // The output object is what gets returned; rules are written into it as they resolve
  const output: Item = {};
  // Count of rules still unresolved; the pass loop below stops when this stops shrinking
  let invalid = Object.keys(transformers).length;
  // A non-object input is treated as empty rather than throwing
  input = isObject(input) ? input : {};

  const processData = (k: string, v: any) => {
    // The value currently stored under this key in the input
    const inputValue = input[k];

    // The callback payload: this level's snapshot first, then the ancestor snapshots that
    // the enclosing transform passed down as `layers` (empty at the top level)
    const params: any = [
      {
        key: k,
        value: inputValue,
        input,
        output,
      },
    ].concat(layers);

    const transformedValue = typeSwitch(v, {
      function: (data) => {
        // Function rule: invoke it with the payload built above
        return data.value(...params);
      },
      // Object rule: recurse, treating the rule map as a nested transformer and the input
      // value at this key as the nested input
      object: (data) => {
        return objectTransform(inputValue, data.value, params);
      },
      // Literal rule (string/number/boolean/null/undefined): used as the value verbatim
      default: () => v,
    });

    if (transformedValue !== undefined) {
      // Only a resolved rule is written; an undefined result leaves the key pending
      output[k] = transformedValue;
      invalid--;
    }
  };

  // Re-run the whole rule map until a pass resolves nothing new
  while (invalid) {
    const remaining = invalid;
    // One pass over every rule
    objectEach(transformers, ({ key, value }: any) => {
      // Keys already resolved in an earlier pass are skipped (dependency ordering)
      if (!objectHasKey(output, key)) {
        processData(key, value);
      }
    });

    // Nothing resolves, meaning cannot resolve further
    if (remaining === invalid) break;
  }

  return output;
};
