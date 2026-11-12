/**
 * Object filter utility.
 *
 * Similar to `Array.filter`, returns a new object containing only the
 * properties for which the predicate callback returns a truthy value.
 */
import { objectEach } from './each';

/**
 * Filters an object, keeping only properties whose callback returns truthy.
 *
 * @typeParam T - The type of the source object.
 * @param object - The object to filter.
 * @param callback - Predicate invoked for each property; return truthy to keep.
 * @returns A new object with only the properties that passed the filter.
 */
export const objectFilter = <T extends {}>(
  object: T,
  callback: (args: {
    /** Zero-based index. */
    index: number;
    /** The property key. */
    key: keyof T;
    /** The property value. */
    value: T[keyof T];
    /** The source object. */
    object: T;
  }) => any,
) => {
  const result: { [key in keyof T]?: T[keyof T] } = {};
  objectEach(object, (data) => {
    // If Trigger Callback is True. Filter out Function
    if (callback(data)) result[data.key] = data.value;
  });
  // Return Possible Result
  return result;
};
