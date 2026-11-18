import * as objectModule from './index';
import { objectEach, objectUpdate, objectCreate } from '@presource/core';

/**
 * src/object/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the `export *` lines in
 * src/object/index.ts and the runtime exports of each source file:
 *   ./alias     -> objectAlias (alias.ts)       ./map      -> objectMap (map.ts),
 *   ./create    -> objectCreate (create.ts)              objectMapKeys (map.ts)
 *   ./each      -> objectEach (each.ts),                ./merge      -> objectMerge (merge.ts)
 *                 objectEachAsync (each.ts)            ./observe    -> objectObserve (observe.ts)
 *   ./ensures   -> objectEnsures (ensures.ts)           ./populate   -> objectPopulate (populate.ts)
 *   ./extract   -> objectExtract (extract.ts)           ./proxy      -> objectProxy (proxy.ts)
 *   ./fill      -> objectFill (fill.ts)                 ./registry   -> objectRegistry (registry.ts)
 *   ./filter    -> objectFilter (filter.ts)             ./resolve    -> objectResolve (resolve.ts)
 *   ./flatten   -> objectFlatten (flatten.ts)           ./scan       -> objectScan (scan.ts)
 *   ./has       -> objectHasKey (has.ts)                ./shuffle    -> objectShuffle (shuffle.ts)
 *   ./switch    -> objectSwitch (switch.ts)             ./transform  -> objectTransform (transform.ts)
 *   ./trigger   -> objectTrigger (trigger.ts)           ./unflatten  -> objectUnflatten (unflatten.ts)
 *   ./update    -> objectUpdate (update.ts)
 *
 * TYPE-ONLY EXPORT — pinned by this list: `ObjectConstant` (src/object/constant.ts)
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
        // the intent (`ObjectConstant` in src/object/constant.ts is `export type`, never re-exported).
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
