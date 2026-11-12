/**
 * Object map utility.
 *
 * Similar to `Array.map`, transforms every value in an object while
 * preserving keys. Also provides `objectMapKeys` to remap keys.
 */
import { objectEach } from './each';

/** Arguments passed to the map callback. */
type Argument<T> = {
    /** The source object. */
    object: T;
    /** The current property value. */
    value: T[keyof T];
    /** The current property key. */
    key: keyof T;
    /** Zero-based iteration index. */
    index: number;
};

/**
 * Maps over every property of an object, transforming each value while keeping keys.
 *
 * @typeParam T - The type of the source object.
 * @typeParam V - The resulting value type after transformation.
 * @param object - The object to iterate.
 * @param callback - Invoked for each property; its return becomes the new value.
 * @returns A new object with the same keys and transformed values.
 */
export const objectMap = <T extends {}, V>(
    object: T,
    callback: (args: Argument<T>) => V
) => {
    // Constructing the Return result
    const result: any = {};

    // Looping Through Each Object
    objectEach(object, (data) => {
        // Extracting Key out of Data
        const { key } = data;
        // Setting Callback Result to Key
        result[key] = callback(data);
    });

    // Returning the Result Information
    return result as { [key in keyof T]: V };
};

/**
 * Maps over every property of an object, transforming each key while keeping the original values.
 *
 * The callback's return value becomes the new key (falling back to the original key if `null`/`undefined`).
 *
 * @typeParam T - The type of the source object.
 * @typeParam V - The resulting key type (must be a string).
 * @param object - The object to iterate.
 * @param callback - Invoked for each property; its return becomes the new key.
 * @returns A new object with remapped keys and original values.
 */
export const objectMapKeys = <T extends {}, V extends string>(
    object: T,
    callback: (args: Argument<T>) => V
) => {
    // The Resulting Object
    const result: any = {};

    objectEach(object, (data) => {
        // Extracting Key Data
        const { key, value } = data;
        // Updating the Result
        result[callback(data) ?? key] = value;
    });
    // Return the Result
    return result as { [key in V]: T[keyof T] };
};
