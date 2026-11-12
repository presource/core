import { typeConstructor } from './constructor';

/**
 * Constructor -> resolved type-name memo cache.
 *
 * `typeName` sits on the hot path of every `typeSwitch` / `typeSwitchAsync` /
 * `isFunction` call, where the same handful of constructors (Number, String,
 * Array, ...) are inspected millions of times. Reading `ctor.name` and
 * lower-casing it is pure re-work in that case, so the resolved name is
 * memoised per constructor. WeakMap keys never keep a user class alive, so the
 * cache cannot leak.
 *
 * Trade-off: the name is captured the first time a constructor is seen, so
 * mutating `SomeClass.name` afterwards is not re-read by `typeName`.
 */
const nameCache = new WeakMap<object, string>();

/**
 * Returns the lower-case constructor name of a value.
 *
 * For most values this yields strings like `"string"`, `"number"`,
 * `"object"`, `"array"`, etc. For `null` and `undefined` the
 * constructor is absent so the function returns an empty string
 * (consumers should check for that case).
 *
 * @param value - Any value to inspect.
 * @returns The lower-case constructor name, or `""` when the value has no constructor.
 */
export const typeName = (value: any) => {
    const ctor = typeConstructor(value);

    // null / undefined / null-prototype values have no constructor at all, so the
    // '' sentinel is produced without touching the cache (WeakMap rejects them).
    if (ctor === undefined || ctor === null) return '';

    const cached = nameCache.get(ctor);
    if (cached !== undefined) return cached;

    // Legacy semantics kept verbatim: a falsy `name` becomes '', a truthy
    // non-string `name` (e.g. `{ constructor: { name: 42 } }`) still throws
    // because numbers have no `toLowerCase`, and every result is lower-cased.
    // The optional chain is load-bearing, not decoration: V8 builds the failing
    // receiver text from the expression shape, and `(x?.name || '')` reports the
    // exact legacy "(intermediate value) || ..." TypeError message, while a plain
    // `(x.name || '')` would report "(x.name || ...)". Keeping the original lookup
    // count (one `value.constructor` read) matters more than dropping the `?.`.
    const name = ((ctor as any)?.name || '').toLowerCase();

    // WeakMap keys must be objects: an override such as `{ constructor: 'str' }`
    // resolves through the normal path every time but cannot be memoised.
    if (typeof ctor === 'function' || typeof ctor === 'object') nameCache.set(ctor, name);

    return name;
};
