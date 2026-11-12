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
 * @param layers - Previously accumulated argument snapshots for nested calls.
 * @returns A new object with the transformed values.
 */
export const objectTransform: Structure = (input, transformers, layers = []) => {
  // The Resulting object
  const output: Item = {};
  // Getting the amount of invalid total
  let invalid = Object.keys(transformers).length;
  // Making sure input is an object
  input = isObject(input) ? input : {};

  const processData = (k: string, v: any) => {
    // Getting the input value
    const inputValue = input[k];

    // The Current param level
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
        // Return the transform data
        return data.value(...params);
      },
      // If it is an object, then try to do nesting
      object: (data) => {
        // Nested transformation
        return objectTransform(inputValue, data.value, params);
      },
      default: () => v,
    });

    if (transformedValue !== undefined) {
      // Only save to output if transformed value is not undefined
      output[k] = transformedValue;
      invalid--;
    }
  };

  // Continuing to resolve!
  while (invalid) {
    const remaining = invalid;
    // Scanning through each item and apply transformation
    objectEach(transformers, ({ key, value }: any) => {
      // Continue to process until validation is complete
      if (!objectHasKey(output, key)) {
        processData(key, value);
      }
    });

    // Nothing changes, meaning cannot resolve further
    if (remaining === invalid) break;
  }

  // Return the resulting object
  return output;
};
