/**
 * Object populate utility.
 *
 * Intended to populate an object with values from a secondary data source,
 * preserving the original reference.
 * (Currently a stub implementation.)
 */
import { objectEach } from './each';

/** Signature for the populate function. */
type ObjectPopulate = <T, P>(referencedObject: T, populationData: P) => any;

/**
 * Populates `referencedObject` with values derived from `populationData`.
 *
 * @param referencedObject - The object to populate in place.
 * @param populationData - The source data used to fill in the object.
 * @returns Currently `undefined` (stub).
 */
export const objectPopulate: ObjectPopulate = (referencedObject, populationData) => {
  return undefined;
};
