import * as objectModule from './index';
import { objectEach, objectUpdate, objectCreate } from '@presource/core';

/**
 * src/object/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the 23 `export *` lines in
 * src/object/index.ts (lines 6-28) and the runtime exports of each source file:
 *   ./alias     -> objectAlias    (alias.ts:35)      ./map      -> objectMap (map.ts:30),
 *   ./create    -> objectCreate   (create.ts:39)                objectMapKeys (map.ts:60)
 *   ./each      -> objectEach (each.ts:66),                    ./merge      -> objectMerge (merge.ts:22)
 *                 objectEachAsync (each.ts:89)                ./observe    -> objectObserve (observe.ts:49)
 *   ./ensures   -> objectEnsures  (ensures.ts:25)             ./populate   -> objectPopulate (populate.ts:20)
 *   ./extract   -> objectExtract  (extract.ts:59)             ./proxy      -> objectProxy (proxy.ts:46)
 *   ./fill      -> objectFill     (fill.ts:19)                ./registry   -> objectRegistry (registry.ts:46)
 *   ./filter    -> objectFilter   (filter.ts:17)              ./resolve    -> objectResolve (resolve.ts:19)
 *   ./flatten   -> objectFlatten  (flatten.ts:46)             ./scan       -> objectScan (scan.ts:50)
 *   ./has       -> objectHasKey   (has.ts:15)                 ./shuffle    -> objectShuffle (shuffle.ts:17)
 *   ./switch    -> objectSwitch   (switch.ts:45)              ./transform  -> objectTransform (transform.ts:46)
 *   ./trigger   -> objectTrigger  (trigger.ts:43)             ./unflatten  -> objectUnflatten (unflatten.ts:29)
 *   ./update    -> objectUpdate   (update.ts:18)
 *
 * TYPE-ONLY EXPORT — pinned by this list: `ObjectConstant` (src/object/constant.ts:3)
 * is `export type` only AND its file is not even listed in the barrel's `export *`
 * lines, so it must NOT appear in the runtime key list below. The same applies to the
 * per-file signature types (ObjectAlias, ObjectExtract, ObjectObserve, Structure, ...).
 * Note there is no `src/object/constant.ts` re-export line to accidentally pull it in.
 */
const EXPECTED_EXPORTS = [
    'objectAlias',
    'objectCreate',
    'objectEach',
    'objectEachAsync',
    'objectEnsures',
    'objectExtract',
    'objectFill',
    'objectFilter',
    'objectFlatten',
    'objectHasKey',
    'objectMap',
    'objectMapKeys',
    'objectMerge',
    'objectObserve',
    'objectPopulate',
    'objectProxy',
    'objectRegistry',
    'objectResolve',
    'objectScan',
    'objectShuffle',
    'objectSwitch',
    'objectTransform',
    'objectTrigger',
    'objectUnflatten',
    'objectUpdate',
];

describe('object barrel (src/object/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(objectModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('ObjectConstant is type-only and absent from the runtime surface', () => {
        // Exact-key assertion above already excludes it; this explicit check documents
        // the intent (src/object/constant.ts:3 is `export type`, never re-exported).
        expect(Object.keys(objectModule).sort().includes('ObjectConstant')).toBe(false);
        expect((objectModule as any).ObjectConstant).toBeUndefined();
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(objectModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(objectModule.objectEach).toBe(objectEach);
        expect(objectModule.objectUpdate).toBe(objectUpdate);
        expect(objectModule.objectCreate).toBe(objectCreate);
    });

    test('the re-exported objectMerge still deep-merges (merge.ts:22-49)', () => {
        expect(objectModule.objectMerge({ a: { b: 1 } }, { a: { c: 2 } }))
            .toStrictEqual({ a: { b: 1, c: 2 } });
        // Later objects win on scalar conflicts
        expect(objectModule.objectMerge({ a: 1 }, { a: 2, b: 3 })).toStrictEqual({ a: 2, b: 3 });
    });

    // --- pre-existing behavioural smoke checks (kept from the original thin file) ---

    test('should export objectEach', () => {
        expect(objectEach).toBeInstanceOf(Function);
    });

    test('should export objectUpdate', () => {
        expect(objectUpdate).toBeInstanceOf(Function);
    });

    test('should export objectCreate', () => {
        expect(objectCreate).toBeInstanceOf(Function);
    });
});
