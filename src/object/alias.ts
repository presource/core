/**
 * Object alias utility.
 *
 * Creates a proxy over a data object where additional shorthand property
 * names (aliases) resolve to the same values as existing keys.
 */
import { ObjectConstant } from './constant';
import { objectProxy } from './proxy';

/**
 * Type describing the aliased proxy result.
 *
 * The union of the original data keys and the alias keys is exposed,
 * but all values resolve to properties of the original `Data`.
 */
export type ObjectAlias = <Data extends ObjectConstant, Alias extends ObjectConstant>(
    data: Data,
    alias: Alias
) => {
    [key in keyof Data | keyof Alias]: Data[keyof Data];
};

/**
 * Wraps `data` in a proxy that maps alias keys back to real keys in `data`.
 *
 * When an alias key is accessed, the proxy resolves it to the corresponding
 * real key via the `alias` map. Writes are similarly forwarded.
 *
 * __The alias map is snapshotted once, at construction__ (own enumerable string
 * keys only, into a prototype-less copy). Three consequences follow:
 *
 * 1. __Inherited alias entries no longer resolve.__ Only own entries are copied, so a map
 *    that carries its entries on its prototype (e.g. `Object.create({ i: 'index' })`) now
 *    behaves as an empty map: `alias.i` falls back to the accessed key. HEAD read
 *    `alias[key]` live on every trap, so the prototype-chain entry resolved. The flip side
 *    of the same change is the hijack fix: an *unmapped* key whose name is also an
 *    `Object.prototype` member (`toString`, `constructor`, …) used to resolve to that
 *    inherited function as the "real key" and therefore missed the real data entry.
 * 2. __Symbol alias keys never resolve through the map.__ `Object.keys` skips symbol entries,
 *    so a symbol key is always unmapped and falls back to the accessed key itself — even
 *    when the map carries that symbol (HEAD's live lookup would have forwarded it). Pinned
 *    by `symbol keys bypass the alias map` in src/object/alias.test.ts.
 * 3. __Later edits to the map object are invisible__ to an already-created proxy (the
 *    underlying `data` object still stays live).
 *
 * @throws {TypeError} `Cannot convert undefined or null to object` when `alias` is `null`
 *         or `undefined`. This now happens eagerly at construction (the `Object.keys`
 *         snapshot); HEAD only failed later, lazily, on the first `get`/`set` that read
 *         `alias[key]` through the traps.
 * @typeParam Data - The type of the underlying data object.
 * @typeParam Alias - The type of the alias mapping object.
 * @param data - The data object to wrap.
 * @param alias - A map from alias keys to real property names (object with own entries).
 * @returns A proxied object that supports both original and aliased keys.
 */
export const objectAlias: ObjectAlias = (data: any, alias: any) => {
    // Snapshot the alias map once per call. Every proxy get/set used to read `alias[key]`
    // through the live map, walking the prototype chain on each miss — both an unwanted
    // `Object.prototype` entry such as `toString` and a legitimately inherited entry (a map
    // built with `Object.create`) could become the "real key". A prototype-less copy makes
    // the lookup a plain own-property read; own entries only. `Object.keys` also fails fast
    // on a null/undefined map (`Cannot convert undefined or null to object`), moving the
    // throw from the first proxied access to construction time.
    const aliasMap: Record<string, any> = Object.create(null);
    Object.keys(alias).forEach((key) => {
        aliasMap[key] = alias[key];
    });

    // `||` is the documented fallback: a falsy target (e.g. an empty string) resolves back to
    // the accessed key instead of forwarding to a bogus property name. Symbol keys are never in
    // the snapshot, so they always take this fallback and address the accessed key itself; they
    // no longer resolve even when the map declares them (see the JSDoc note above).
    const getActualKey = (key: string) => aliasMap[key] || key;

    // Constructing an Object Alias
    return objectProxy(data, {
        get: ({ k }) => data[getActualKey(k)],
        set: ({ k, v }) => {
            data[getActualKey(k)] = v;
        }
    });
};
