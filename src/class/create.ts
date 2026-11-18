/**
 * Dynamic class factory.
 *
 * Exposes `classCreate`, which builds a class from a `{ key: default }` shape.
 */

import { objectEach } from '../object';

/** Signature: builds a class whose instances carry the given defaults. */
type ClassCreate = <T extends {}>(properties: T) => new (...args: any[]) => T;

/**
 * Build a class from a `{ key: defaultValue }` shape.
 *
 * The shape is walked with `objectEach` (i.e. `Object.keys`), so positional constructor
 * arguments bind by KEY INSERTION ORDER — integer-like keys (`2`, `1`) are enumerated in
 * ascending numeric order, not declaration order. A slot keeps its default only when the
 * argument is strictly `undefined`, so `0`, `''`, `false` and `null` all override it.
 *
 * Reference defaults (arrays/objects) are NOT cloned: every instance shares the shape's
 * value. The shape is also captured by the constructor closure, so editing `properties`
 * after the class exists changes the defaults used by the NEXT instance. Extra arguments
 * beyond the shape's keys are never read.
 *
 * @param properties - Object mapping property names to their default values.
 * @returns A class; `new Class(...values)` fills the slots in shape order.
 */
export const classCreate: ClassCreate = (properties) => {
    // Building a class object (a bare `class` — instances get no named constructor)
    const result: any = class {
        // Creating a Constructor
        constructor(...args: any[]) {
            // Scanning through the argument — `index` is the shape key's position, so
            // `args[index]` is that slot's positional override
            objectEach(properties, ({ key, value, index }) => {
                // Checking the user inputted value — only `undefined` counts as "not provided"
                const val = args[index];
                // Updating itself — the override wins over the default, everything else keeps it
                (this as any)[key] = val === undefined ? value : val;
            });
        }
    };

    // Returning the Class
    return result;
};
