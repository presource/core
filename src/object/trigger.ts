/**
 * Object trigger utility.
 *
 * Iterates over an object's properties and invokes a trigger callback when
 * a matching key is found in the provided trigger map. Properties without
 * a matching trigger are copied as-is to the output.
 */
import { isObject } from '../is';
import { objectEach } from './each';
import { objectHasKey } from './has';
import { objectUpdate } from './update';

/** Arguments passed to each trigger callback. */
type Arguments = {
    /** The value associated with the key. */
    value: any;
    /** The property key. */
    key: string;
    /** The original input object. */
    input: { [key: string]: any };
    /** The accumulated output object. */
    output: { [key: string]: any };
};

/** A trigger callback function that receives the arguments object. */
type TriggerFunction = (args: Arguments) => any;

/** A map from property keys to their trigger callbacks. */
type TriggerList = { [key: string]: TriggerFunction };

/**
 * Expands an input object by invoking registered trigger callbacks.
 *
 * For each property in `input`, if a matching key exists in `triggers`,
 * the corresponding callback is invoked with a rich arguments object.
 * If the callback returns a plain object, its own enumerable keys are shallow-merged into
 * the output (overwriting on conflict); any other return value - including a primitive -
 * is discarded, and the property itself is then absent from the output.
 * Properties with no matching trigger are copied unchanged.
 *
 * @param input - The object to iterate over.
 * @param triggers - A map of keys to trigger callbacks.
 * @returns A new object built from the trigger results.
 */
export const objectTrigger = (input: { [key: string]: any }, triggers: TriggerList): { [key: string]: any } => {
    // The output object, built by walking the input
    const output: { [key: string]: any } = {};
    // Every own key of the input is either routed to its trigger or copied over
    objectEach(input, ({ value, key }) => {
        if (objectHasKey(triggers, key)) {
            // The callback payload; `output` is live, so a trigger can read what came before
            const params: any = {
                value,
                key,
                input,
                output,
            };

            // Run the trigger for this key
            const result = triggers[key](params);
            // A plain-object result is shallow-merged into the output; anything else is dropped
            if (isObject(result)) objectUpdate(output, result);
        } else {
            // No trigger registered: copy the entry through as-is
            output[key] = value;
        }
    });
    return output;
};
