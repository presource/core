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
 * Unimplemented: both parameters are accepted but never read, and the call is a
 * no-op that writes nothing to `referencedObject`.
 *
 * @param referencedObject - The object intended to be populated in place.
 * @param populationData - The source data intended to fill in the object.
 * @returns Always `undefined` (stub) - notably NOT the populated object.
 */
export const objectPopulate: ObjectPopulate = (referencedObject, populationData) => {
  return undefined;
};
