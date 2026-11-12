/**
 * Object create utility.
 *
 * Constructs a new object from a set of keys and a value source.
 * Keys can be a number (range), string (single key), or array.
 * Values can be a literal, an array (paired by index), or a function.
 */
import { typeSwitch } from '../type';

/** Acceptable key types: a count, a single key string, or an array of keys. */
type Keys = number | string | any[];

/** Acceptable value sources: a literal, an array paired by index, or a function. */
type Values =
    | number
    | string
    | boolean
    | undefined
    | null
    | any[]
    | (({ value, index }: { value: any; index: number }) => any);

/**
 * Creates a new object from a key specification and a value source.
 *
 * - **number** keys: generates keys `"0"` through `"n-1"`.
 * - **string** keys: uses the string as a single key.
 * - **array** keys: uses each element as a key.
 *
 * Values are resolved via a callback derived from `values`:
 * a function is used directly, an array is paired by index, and
 * a literal is wrapped as a constant-returning function.
 *
 * @param keys - A number, string, or array of keys.
 * @param values - A value, array of values, or value-producing function.
 * @returns A new object mapping each key to its resolved value.
 */
export const objectCreate = (keys: Keys, values: Values): { [key: string]: any } => {
    const result: { [key: string]: any } = {};

    // Converting Keys into proper string[]
    // `keyCount` stays -1 for every non-numeric key input; a number is a *count*, so the
    // loop below walks the counter directly instead of building `arrayCreate(n)` and
    // mapping it to `[0..n-1]` on every call.
    let keyCount = -1;
    const keysList: string[] = typeSwitch(keys, {
        // If Number. Keys fill with 0 to number value
        // Number should be positive. The clamp mirrors arrayCreate's number mode
        // (array/create.ts:71) so -3 / NaN collapse to zero keys and 2.7 to two keys.
        number: ({ value }) => {
            keyCount = value > 0 ? Math.floor(value) : 0;
            // The list is unused for numeric keys; return an empty one to keep typeSwitch happy
            return [];
        },
        // If String, return a single value
        string: () => [keys],
        // If input is an array.
        array: () => keys,
        // Default Return Array
        default: () => []
    });

    // Return a Value Function
    const callback = typeSwitch(values, {
        // If Function. Return the Values
        function: () => values,
        array:
            ({ value }) =>
            // Construct a Remap Array by Key for Values
            ({ index }: { index: number }) =>
                value[index],
        // By Default. Create a Stand in Function
        default: () => () => values
    });

    if (keyCount >= 0) {
        // Numeric keys: the callback receives the numeric index as both `value` and `index`
        // (the old `arrayCreate(keys).map((_, index) => index)` produced exactly that pair).
        for (let index = 0; index < keyCount; index++) {
            result[index] = callback({ value: index, index });
        }
    } else {
        // forEach is required here: sparse key arrays must skip their holes.
        keysList.forEach((value, index) => {
            result[value] = callback({ value, index });
        });
    }
    // Returning the Result
    return result;
};
