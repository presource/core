// JSON-backed in-memory table with CRUD over a flat array (memory.database).
// Identity field is read dynamically from memory.schema.id at every access
// (see table.test.ts "dynamic key reference") — so it can be mutated at runtime.
//
// API surface: get / find / add / delete (add is upsert: insert when absent,
// shallow merge when present — collapses the old insert+update pair into one
// call). find returns the closest entry by count of matching query fields.
//
// Perf model:
// - O(1) get/add/delete via a string->index Map cache.
// - The cache is rebuilt lazily only when (a) it has not been built, or
//   (b) the active id-field changed since the last build. This avoids the
//   per-call full scan while still honoring the dynamic-key contract.
// - delete uses swap-with-last + pop (O(1)) instead of splice (O(n)) and
//   patches the moved entry's Map slot rather than clearing/rebuilding.

type Memory<T> = {
    schema: {
        name: string;
        id: string;
    };
    database: T[];
};

type Configuration<T> = {
    name: string;
    key: keyof T & string;
    memory?: Memory<T>;
    onChange?: () => void;
};

type JsonTableInstance<T> = {
    memory: () => Memory<T>;
    config: () => Configuration<T>;
    get: (id: string) => T | null;
    find: (query: { [key: string]: any }) => T | null;
    add: (input: Partial<T>) => T;
    delete: (id: string) => boolean;
};

type JsonTable = {
    <T>(config: Configuration<T>): JsonTableInstance<T>;
    <T>(tableName: string): JsonTableInstance<T>;
};

export const jsonTable: JsonTable = (<T>(input: Configuration<T> | string) => {
    const config: Configuration<T> = typeof input === 'string'
        ? { name: input, key: `${input}Id` as keyof T & string }
        : input;

    // Default memory mirrors config; schema.id is the live identity field source.
    const memory: Memory<T> = config.memory ?? {
        schema: { name: config.name, id: config.key },
        database: []
    };

    const store: T[] = memory.database;

    // Lazy id->index cache. `indexField` records the field the cache was built
    // for; a mismatch with the live schema.id forces a rebuild (dynamic key).
    const index = new Map<string, number>();
    let indexField: string | null = null;

    // Read the value of `field` from an entry without per-call allocation.
    const valueOf = (entry: T, field: string): string | undefined =>
        (entry as Record<string, unknown>)[field] as string | undefined;

    // Rebuild the cache only when stale relative to the live id-field.
    const sync = (): string => {
        const field = memory.schema.id;
        if (indexField !== field) {
            index.clear();
            for (let i = 0; i < store.length; i++) {
                const id = valueOf(store[i], field);
                if (id != null) index.set(id, i);
            }
            indexField = field;
        }
        return field;
    };

    const instance: JsonTableInstance<T> = {
        memory: () => memory,
        config: () => config,

        // Return a shallow copy so callers can't mutate stored entries in place.
        get: (id: string) => {
            sync();
            const idx = index.get(id);
            if (idx === undefined) return null;
            return { ...store[idx] } as T;
        },

        // Closest-match scan: score each entry by count of query fields it
        // matches (strict ===); return the highest scorer, ties broken by
        // first encountered. Optimisations:
        // - Hoist query keys once (Object.keys) instead of per-entry.
        // - Fast-path the id field through the index Map when the query keys
        //   are exactly [idField] (single-field id lookup -> O(1)).
        // - Short-circuit: a full match (score === keyCount) returns immediately,
        //   and per-entry scoring aborts once the remaining fields can't beat
        //   the current best.
        find: (query: { [key: string]: any }) => {
            const field = sync();
            const keys = Object.keys(query);
            const keyCount = keys.length;
            // Empty query has no discriminating power -> no meaningful match.
            if (keyCount === 0) return null;

            // O(1) fast path: querying solely by the active id field.
            if (keyCount === 1 && keys[0] === field) {
                const idx = index.get(query[field] as string);
                return idx === undefined ? null : ({ ...store[idx] } as T);
            }

            let bestEntry: T | null = null;
            let bestScore = 0;
            for (let i = 0; i < store.length; i++) {
                const entry = store[i] as Record<string, unknown>;
                let score = 0;
                for (let k = 0; k < keyCount; k++) {
                    const key = keys[k];
                    if (entry[key] === query[key]) {
                        score++;
                        // First 100% match wins; nothing can score higher.
                        if (score === keyCount) return { ...store[i] } as T;
                    } else if (score + (keyCount - k - 1) <= bestScore) {
                        // Remaining possible points can't exceed best -> bail.
                        break;
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestEntry = store[i];
                }
            }
            return bestEntry === null ? null : ({ ...bestEntry } as T);
        },

        // Upsert: merge into existing entry, or append a new one.
        // Auto-generates an id (using the live field) when absent.
        add: (input: Partial<T>) => {
            const field = sync();
            const record = input as Record<string, unknown>;
            let id = record[field] as string | undefined;
            if (id == null) {
                id = crypto.randomUUID();
                record[field] = id;
            }
            const existingIdx = index.get(id);
            if (existingIdx === undefined) {
                index.set(id, store.length);
                store.push(input as T);
                config.onChange?.();
                return input as T;
            }
            // Shallow-merge keeps untouched fields (see "merges partial data").
            const merged = { ...store[existingIdx], ...input } as T;
            store[existingIdx] = merged;
            config.onChange?.();
            return merged;
        },

        // O(1) delete via swap-with-last + pop; patch the moved entry's slot.
        delete: (id: string) => {
            const field = sync();
            const existingIdx = index.get(id);
            if (existingIdx === undefined) return false;
            const lastIdx = store.length - 1;
            if (existingIdx !== lastIdx) {
                const moved = store[lastIdx];
                store[existingIdx] = moved;
                const movedId = valueOf(moved, field);
                if (movedId != null) index.set(movedId, existingIdx);
            }
            store.pop();
            index.delete(id);
            config.onChange?.();
            return true;
        }
    };

    return instance;
}) as JsonTable;
