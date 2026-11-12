import { objectEach } from '../object';

/** Creation of the Class Create */
type ClassCreate = <T extends {}>(properties: T) => new (...args: any[]) => T;

/** Creating Class from an Object Format */
export const classCreate: ClassCreate = (properties) => {
    // Building a class object
    const result: any = class {
        // Creating a Constructor
        constructor(...args: any[]) {
            // Scanning through the argument
            objectEach(properties, ({ key, value, index }) => {
                // Checking the user inputted value
                const val = args[index];
                // Updating itself
                (this as any)[key] = val === undefined ? value : val;
            });
        }
    };

    // Returning the Class
    return result;
};
