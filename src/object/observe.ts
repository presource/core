/**
 * Object observe utility.
 *
 * Creates a reactive observer for an object using a Proxy. Every property
 * `get` or `set` operation fires a callback with full context.
 *
 * Hot-path shape (perf issue H4): one Proxy is memoized per raw object and a level records its
 * path/depth as a plain pair that a hand-off re-stamps, so a deep read such as `observed.a.b.c`
 * no longer allocates a fresh Proxy plus a fresh recursion chain on every hop. Exactly one path
 * array is still built per emitted event, because that is what the callback contract exposes.
 */
import { isObject } from '../is';
import { objectProxy } from './proxy';

type Item = { [key: string]: any };

/** Arguments passed to the observe callback. */
type Arguments = {
    /** The object being observed. */
    object: Item;
    /** The property key. */
    key: string;
    /** The value being read (get) or assigned (set). */
    value: any;
    /** The previous value of the property before the operation. */
    current: any;
    /** The proxy trap that fired: `"get"` or `"set"`. */
    method: string;
    /** Nesting depth of the current property in the observed tree. */
    depth: Memory['depth'];
    /** Path of keys from the root to the current property. */
    path: Memory['path'];
};

/** Callback invoked on every observed property access or mutation. */
type Callback = (args: Arguments) => void;

/** Internal state tracking recursion depth and the current key path. */
type Memory = { depth: number; path: string[] };

/** Signature of the observe function. */
export type ObjectObserve = (item: Item, callback: Callback, memory?: Memory) => Item;

/** Payload handed to the traps by `objectProxy` (see src/object/proxy.ts). */
type TriggerArgs = { object: Item; key: string; value: any; method: string };

/** Per raw object observation state inside one observer: its wrapper plus its path context. */
type Level = {
    /** The memoized Proxy handed out for this raw object (never the raw object itself). */
    proxy: Item;
    /** Keys from the observer root down to this level, as of the most recent hand-off. */
    prefix: Memory['path'];
    /** Depth reported for the keys this level owns; one less than its children's depth. */
    depth: number;
};

/**
 * Wraps an object in a reactive observer Proxy that fires a callback on every property access.
 *
 * Nested object values are themselves re-wrapped, enabling deep observation.
 *
 * __Proxy identity is stable (behaviour change).__ Each raw object is wrapped at most once per
 * observer, so `observed.a === observed.a` is now `true`; it used to be `false` because every
 * read built a brand new Proxy. A wrapper is still never the raw object itself, so checks like
 * `observed.a !== source.a` keep working. The cache lives inside one `objectObserve(...)` call and
 * uses weak keys, so two observers over the same data never share wrappers and wrappers never
 * keep observed data alive. Because one wrapper now serves a raw object from every route, an
 * object reachable through two different paths reports the path of the most recent hand-off
 * (`obs.x.shared` followed by `obs.y.shared.k` reports `['y','shared','k']`).
 *
 * __Cyclic walks report collapsed paths.__ A hand-off that points back into the level that is
 * already stamping it (the same level, or the root — i.e. `a.self = a` data) is deliberately not
 * re-stamped, otherwise one cyclic read would permanently drift an unrelated context (see the
 * `child !== level && child !== root` guard in the `get` trap). Such a walk therefore reports the
 * collapsed path/depth of the level it lands on, not the chain it was spelled with:
 * `obs.self.self.k` emits `self@0:['self']`, `self@0:['self']` and `k@0:['k']`. Before this
 * change every hop rebuilt a nested observer, so the same read reported the growing chain
 * (`self@0:['self']`, `self@1:['self','self']`, `k@2:['self','self','k']`) — pinned by
 * `Cyclic data resolves to the same wrapper without drifting the root context` in
 * src/object/observe.test.ts.
 *
 * __Emitted payloads stay snapshots.__ Every event receives its own `path` array and its own
 * params object, and the observer never writes into an array it has already handed out, so a
 * callback may retain `args` (and mutate `args.path`) without affecting later events.
 *
 * @param item - The object to observe.
 * @param callback - Invoked on every `get` or `set` with full context.
 * @param chain - Internal state for depth and path tracking. Defaults to `{ depth: 0, path: [] }`.
 *                Treated as a seed only: the caller's `path` array is copied, never mutated.
 * @returns A Proxy wrapping `item` with observation behaviour.
 */
export const objectObserve: ObjectObserve = (item, callback, chain = { depth: 0, path: [] }) => {
    // Per-observer memo: raw object -> its single level record. Weak keys keep it non-retaining,
    // and make cyclic data (`a.self = a`) resolve to the same wrapper instead of recursing.
    const levels = new WeakMap<object, Level>();

    // The root context comes from the seed chain and is never re-stamped below: the root path is
    // fully known, so freezing it keeps cyclic walks from drifting every later root-level event.
    const root: Level = { proxy: null as any, depth: chain.depth, prefix: [...chain.path] };

    /**
     * Builds the `get`/`set` trap pair bound to one raw level object.
     *
     * The closure captures the level RECORD (not its fields), so re-stamping `prefix`/`depth` at
     * hand-off time is immediately visible: the same wrapper stays correct however deeply the
     * object is later reached from.
     *
     * @param object - The raw (un-proxied) object this wrapper proxies.
     * @param level - The memoized context that owns this wrapper.
     */
    const createTriggers = (object: Item, level: Level) => ({
        // Get Observer
        get: ({ key, value, method }: TriggerArgs) => {
            // Path snapshot for this event: the level prefix plus the accessed key. Allocated once
            // per event and never written in place afterwards, so retained payloads stay immutable
            const path = [...level.prefix, key];
            // If the value is not defined, falling back to `{}` lets deep chains continue
            const nested = value !== undefined ? value : {};
            // This is the current value
            const current = object[key];
            // Write-on-read materialization: creates missing keys and copies inherited keys (e.g.
            // `constructor`) onto the target, which is what makes `observed.a.b.c = 1` work
            object[key] = nested;
            // Setting the params
            callback({ key, value, current, object, method, depth: level.depth, path });
            // The callback may have replaced the value, so it is re-read before being wrapped
            const updatedValue = object[key];

            // Primitives are handed back untouched
            if (!isObject(updatedValue)) return updatedValue;

            // Reuse the one wrapper for this raw object instead of allocating a Proxy per read
            const child = levelFor(updatedValue);

            // Record where the wrapper was reached from, so the nested events report this path and
            // depth. Skipped when a hand-off points back at the level itself or at the root (that
            // is cyclic data): re-stamping those would permanently drift an unrelated context.
            if (child !== level && child !== root) {
                child.prefix = path;
                child.depth = level.depth + 1;
            }

            return child.proxy;
        },

        // Set observer
        set: ({ key, value, method }: TriggerArgs) => {
            // Path snapshot for this event (same immutability contract as in `get`)
            const path = [...level.prefix, key];
            // The current value, read before the write lands
            const current = object[key];
            // Updating value on the raw target
            object[key] = value;
            // Creating the params
            callback({ key, value, current, object, method, depth: level.depth, path });

            // Return the necessary boolean value
            return true;
        }
    });

    /**
     * Memoized level accessor: returns the existing record for `target`, creating its Proxy on
     * first use with a provisional context that the calling hand-off stamps immediately after.
     *
     * The record is registered before `objectProxy` runs so a re-entrant read of the same target
     * (cyclic data) can never build two wrappers for it.
     */
    const levelFor = (target: object): Level => {
        const existing = levels.get(target);
        if (existing) return existing;

        const level: Level = { proxy: null as any, depth: 0, prefix: [] };
        levels.set(target, level);
        level.proxy = objectProxy(target as Item, createTriggers(target as Item, level));

        return level;
    };

    // Constructing the root wrapper. `objectProxy` throws before anything is cached if `item` is
    // not object-like, so only valid WeakMap keys ever reach `levels.set`.
    root.proxy = objectProxy(item, createTriggers(item, root));
    levels.set(item, root);

    // Return the Proxy Object
    return root.proxy;
};
