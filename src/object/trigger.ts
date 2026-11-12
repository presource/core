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
 * If the callback returns an object, it is merged into the output.
 * Properties with no matching trigger are copied unchanged.
 *
 * @param input - The object to iterate over.
 * @param triggers - A map of keys to trigger callbacks.
 * @returns A new object built from the trigger results.
 */
export const objectTrigger = (input: { [key: string]: any }, triggers: TriggerList): { [key: string]: any } => {
    // The Output Object. Built by Scanning Through the Input
    const output: { [key: string]: any } = {};
    // Scanning Through the Input
    objectEach(input, ({ value, key }) => {
        if (objectHasKey(triggers, key)) {
            // Constructing the Required Params
            const params: any = {
                value,
                key,
                input,
                output,
            };

            // Constructing the Result
            const result = triggers[key](params);
            // Continue if It is an Object
            if (isObject(result)) objectUpdate(output, result);
        } else {
            // Setting to itself
            output[key] = value;
        }
    });
    // Returning the Output Object
    return output;
};
