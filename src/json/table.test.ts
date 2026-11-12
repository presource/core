import { jsonTable } from './table';

type TestRecord = {
    id: string;
    name: string;
    age?: number;
};

describe('jsonTable', () => {
    describe('initialization', () => {
        it('creates a table with default memory when none provided', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            expect(table.memory().schema).toEqual({ name: 'test', id: 'id' });
            expect(table.memory().database).toEqual([]);
        });

        it('uses provided memory object', () => {
            const memory = {
                schema: { name: 'custom', id: 'customId' },
                database: [{ customId: '1', name: 'existing' } as any]
            };
            const table = jsonTable<any>({ name: 'custom', key: 'customId', memory });
            expect(table.memory()).toBe(memory);
            expect(table.memory().database).toHaveLength(1);
        });

        it('stores config and returns it via config()', () => {
            const config = { name: 'test', key: 'id' };
            const table = jsonTable<TestRecord>(config);
            expect(table.config()).toBe(config);
        });
    });

    describe('add (insert path)', () => {
        it('inserts a record and returns it', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const result = table.add({ id: '1', name: 'Alice' });
            expect(result).toEqual({ id: '1', name: 'Alice' });
            expect(table.memory().database).toHaveLength(1);
            expect(table.memory().database[0]).toEqual({ id: '1', name: 'Alice' });
        });

        it('auto-generates an ID when key is null/undefined', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const result = table.add({ name: 'Bob' } as TestRecord);
            expect(result.id).toBeDefined();
            expect(result.id).toBeTypeOf('string');
            const record = table.memory().database[0];
            expect(record.id).toBeDefined();
            expect(record.id).toBeTypeOf('string');
            expect(record.name).toBe('Bob');
        });

        it('merges duplicate IDs instead of rejecting', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            const result = table.add({ id: '1', name: 'Alice 2' });
            expect(result).toEqual({ id: '1', name: 'Alice 2' });
            expect(table.memory().database).toHaveLength(1);
        });

        it('triggers onChange callback', () => {
            const onChange = vi.fn();
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id', onChange });
            table.add({ id: '1', name: 'Alice' });
            expect(onChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('get', () => {
        it('gets an existing record by id', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            const result = table.get('1');
            expect(result).toEqual({ id: '1', name: 'Alice' });
        });

        it('returns null for non-existing id', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const result = table.get('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('add (update/merge path)', () => {
        it('updates an existing record', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice', age: 25 });
            const updated = table.add({ id: '1', name: 'Alice Updated' });
            expect(updated).toEqual({ id: '1', name: 'Alice Updated', age: 25 });
            expect(table.get('1')).toEqual({ id: '1', name: 'Alice Updated', age: 25 });
        });

        it('inserts a record if id does not exist (upsert)', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const result = table.add({ id: '2', name: 'Bob' });
            expect(result).toEqual({ id: '2', name: 'Bob' });
            expect(table.get('2')).toEqual({ id: '2', name: 'Bob' });
        });

        it('auto-generates an ID on upsert when key is missing', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const result = table.add({ name: 'Charlie' } as TestRecord);
            expect((result as any).id).toBeDefined();
            expect(result.name).toBe('Charlie');
        });

        it('merges partial data with existing record', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice', age: 25 });
            const updated = table.add({ id: '1', age: 26 } as any);
            expect(updated).toEqual({ id: '1', name: 'Alice', age: 26 });
        });

        it('triggers onChange callback on update', () => {
            const onChange = vi.fn();
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id', onChange });
            table.add({ id: '1', name: 'Alice' });
            onChange.mockClear();
            table.add({ id: '1', name: 'Alice Updated' });
            expect(onChange).toHaveBeenCalledTimes(1);
        });

        it('triggers onChange callback on upsert', () => {
            const onChange = vi.fn();
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id', onChange });
            table.add({ id: '99', name: 'New' });
            expect(onChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('find', () => {
        it('returns the entry that matches all query fields', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice', age: 25 });
            table.add({ id: '2', name: 'Bob', age: 30 });
            const result = table.find({ name: 'Bob', age: 30 });
            expect(result).toEqual({ id: '2', name: 'Bob', age: 30 });
        });

        it('returns the closest (highest-scoring) partial match', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice', age: 25 });
            table.add({ id: '2', name: 'Bob', age: 30 });
            // No exact match: Alice matches name only (1), Bob matches age only (1).
            // Alice is encountered first so wins the tie.
            const result = table.find({ name: 'Alice', age: 30 });
            expect(result?.id).toBe('1');
        });

        it('prefers a 100% match over a partial match regardless of order', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            // Partial match first, full match second.
            table.add({ id: '1', name: 'Alice', age: 99 });
            table.add({ id: '2', name: 'Alice', age: 25 });
            const result = table.find({ name: 'Alice', age: 25 });
            expect(result?.id).toBe('2');
        });

        it('returns null when no field matches any entry', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            expect(table.find({ name: 'Nobody' })).toBeNull();
        });

        it('returns null for an empty query', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            expect(table.find({})).toBeNull();
        });

        it('uses the O(1) id fast path for single id-field queries', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            table.add({ id: '2', name: 'Bob' });
            expect(table.find({ id: '2' })).toEqual({ id: '2', name: 'Bob' });
            expect(table.find({ id: 'missing' })).toBeNull();
        });

        it('returns a copy, not the stored reference', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            const found = table.find({ name: 'Alice' });
            found!.name = 'Mutated';
            expect(table.get('1')?.name).toBe('Alice');
        });
    });

    describe('delete', () => {
        it('deletes an existing record and returns true', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alice' });
            const result = table.delete('1');
            expect(result).toBe(true);
            expect(table.memory().database).toHaveLength(0);
        });

        it('returns false for non-existing id', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const result = table.delete('nonexistent');
            expect(result).toBe(false);
        });

        it('triggers onChange callback', () => {
            const onChange = vi.fn();
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id', onChange });
            table.add({ id: '1', name: 'Alice' });
            onChange.mockClear();
            table.delete('1');
            expect(onChange).toHaveBeenCalledTimes(1);
        });

        it('swaps with last when deleting a non-tail entry (covers swap-with-last O(1) delete)', () => {
            // Covers json/table.ts lines 170-175: the swap-with-last block.
            // When deleting an entry that is NOT the last one, the last entry is moved
            // into the deleted entry's slot and its Map cache entry is updated.
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            table.add({ id: '1', name: 'Alpha' });
            table.add({ id: '2', name: 'Beta' });
            table.add({ id: '3', name: 'Gamma' });

            // Delete the first entry (index 0, lastIdx = 2) — triggers swap
            expect(table.delete('1')).toBe(true);
            expect(table.memory().database).toHaveLength(2);

            // The entry formerly at index 2 ('3' / Gamma) should now be at index 0
            expect(table.memory().database[0].name).toBe('Gamma');
            expect(table.memory().database[1].name).toBe('Beta');

            // The cache should still resolve correctly after the swap
            expect(table.get('2')?.name).toBe('Beta');
            expect(table.get('3')?.name).toBe('Gamma');
            expect(table.get('1')).toBeNull();
        });

        it('handles null id in moved entry during swap delete', () => {
            // Covers json/table.ts line 174: `if (movedId != null)` false branch.
            // When the moved (swapped) entry has a null id on the active id-field,
            // the Map cache must skip the index.set for that entry.
            // We need the last entry (which gets swapped) to have null for the
            // active schema id field. Set schema.id to 'customId' and use a null
            // value for that field on the last entry.
            const memory = {
                schema: { name: 'test', id: 'customId' },
                database: [
                    { customId: '1', name: 'Alpha' },
                    { customId: '2', name: 'Beta' },
                    { customId: null, name: 'NullId' }
                ]
            };
            const table = jsonTable<any>({ name: 'test', key: 'customId', memory });

            // Delete '1' (index 0) — the last entry (customId=null) moves to index 0.
            // movedId is null, so index.set is skipped.
            expect(table.delete('1')).toBe(true);
            expect(table.memory().database).toHaveLength(2);

            // The entry with null customId should now be at index 0
            expect(table.memory().database[0].name).toBe('NullId');
            expect(table.memory().database[1].name).toBe('Beta');

            // The cache should be consistent — '2' still resolves
            expect(table.get('2')?.name).toBe('Beta');
            // '1' is deleted
            expect(table.get('1')).toBeNull();
        });
    });

    describe('dynamic key reference', () => {
        it('uses the current memory.schema.id value at access time', () => {
            const memory = {
                schema: { name: 'test', id: 'id' },
                database: [{ id: '1', name: 'Alice' }, { customId: '2', name: 'Bob' }]
            };
            const table = jsonTable<any>({ name: 'test', key: 'id', memory });

            // Initially key is 'id', so '1' finds Alice
            expect(table.get('1')?.name).toBe('Alice');

            // Mutate schema.id to 'customId'
            memory.schema.id = 'customId';

            // Now read('2') looks up by 'customId', finding Bob
            expect(table.get('2')?.name).toBe('Bob');
            // read('1') no longer finds anything since 'id' is no longer the key
            expect(table.get('1')).toBeNull();
        });

        it('insert uses the current schema.id when assigning auto-ID', () => {
            const memory = {
                schema: { name: 'test', id: 'id' },
                database: []
            };
            const table = jsonTable<any>({ name: 'test', key: 'id', memory });

            memory.schema.id = 'customId';

            const result = table.add({ name: 'Auto' });
            expect(result.customId).toBeDefined();
            const record = memory.database[0];
            expect(record.customId).toBeDefined();
            expect(record.id).toBeUndefined();
        });

        it('delete uses the current schema.id', () => {
            const memory = {
                schema: { name: 'test', id: 'id' },
                database: [{ id: '1', name: 'Alice' }, { customId: '2', name: 'Bob' }]
            };
            const table = jsonTable<any>({ name: 'test', key: 'id', memory });

            // Switch key to customId
            memory.schema.id = 'customId';

            // Deleting '2' should now match by customId
            expect(table.delete('2')).toBe(true);
            expect(memory.database).toHaveLength(1);
            expect(memory.database[0].id).toBe('1');
        });

        it('update uses the current schema.id', () => {
            const memory = {
                schema: { name: 'test', id: 'id' },
                database: [{ id: '1', name: 'Alice' }, { customId: '2', name: 'Bob' }]
            };
            const table = jsonTable<any>({ name: 'test', key: 'id', memory });

            // Switch key to customId
            memory.schema.id = 'customId';

            // Update should match '2' by customId
            const updated = table.add({ customId: '2', name: 'Bob Updated' });
            expect(updated.customId).toBe('2');
            expect(updated.name).toBe('Bob Updated');
            expect(memory.database[1].name).toBe('Bob Updated');

            // The record with id '1' should be untouched
            expect(memory.database[0].name).toBe('Alice');
        });
    });

    describe('custom key field', () => {
        it('works with a non-default key field', () => {
            type CustomRecord = { uuid: string; label: string };
            const table = jsonTable<CustomRecord>({ name: 'custom', key: 'uuid' });
            table.add({ uuid: 'a1', label: 'First' });
            expect(table.get('a1')?.label).toBe('First');
            expect(table.get('a1')?.uuid).toBe('a1');
        });

        it('auto-generates on custom key', () => {
            type CustomRecord = { uuid: string; label: string };
            const table = jsonTable<CustomRecord>({ name: 'custom', key: 'uuid' });
            table.add({ label: 'No UUID' } as CustomRecord);
            expect((table.memory().database[0] as any).uuid).toBeDefined();
        });
    });

    describe('string overload (tableName only)', () => {
        it('creates table from string name with auto key', () => {
            // Covers json/table.ts line 47: `typeof input === 'string'` branch.
            // When jsonTable is called with a string, it generates config with
            // name=input and key=`${input}Id`.
            const table = jsonTable<any>('users');
            expect(table.config().name).toBe('users');
            expect(table.config().key).toBe('usersId');
            expect(table.memory().schema.name).toBe('users');
            expect(table.memory().schema.id).toBe('usersId');
        });

        it('string overload works for CRUD operations', () => {
            const table = jsonTable<any>('products');
            table.add({ productsId: 'p1', name: 'Widget' });
            expect(table.get('p1')?.name).toBe('Widget');
            const found = table.find({ name: 'Widget' });
            expect(found?.productsId).toBe('p1');
            expect(table.delete('p1')).toBe(true);
        });
    });

    describe('cache ownership: direct database mutation', () => {
        // `memory()` hands out the LIVE store array (table.ts:83), so callers can push rows
        // that never went through add(). The id->index cache is only rebuilt when the active
        // id FIELD changes (table.ts:69-80), never when the rows change, so the table owns the
        // database: externally inserted rows stay invisible to the id cache.
        it('does not index rows pushed straight into memory().database', () => {
            const table = jsonTable<any>({ name: 'test', key: 'id' });
            table.add({ id: 'a', v: 1 });

            table.memory().database.push({ id: 'z', v: 9, tag: 'direct' });

            // Id-addressed paths still miss the cache...
            expect(table.get('z')).toBeNull();
            expect(table.find({ id: 'z' })).toBeNull();
            // ...while the full-scan path proves the row really is in the store.
            expect(table.find({ v: 9 })).toEqual({ id: 'z', v: 9, tag: 'direct' });

            // add() re-uses the cache, misses 'z', and therefore appends a THIRD row instead
            // of merging into the externally inserted one.
            const added = table.add({ id: 'z', v: 9, tag: 'added' });
            expect(added).toEqual({ id: 'z', v: 9, tag: 'added' });
            expect(table.memory().database).toEqual([
                { id: 'a', v: 1 },
                { id: 'z', v: 9, tag: 'direct' },
                { id: 'z', v: 9, tag: 'added' },
            ]);
            // The cache now maps 'z' to the newly appended index (2), not to index 1.
            expect(table.get('z')).toEqual({ id: 'z', v: 9, tag: 'added' });
        });
    });

    describe('id cache edge cases', () => {
        // Duplicate ids can only appear through seeded/externally mutated memory, because
        // add() always merges into the cached index. Cache building keeps the LAST index
        // (Map.set overwrites), so `get` resolves to the highest duplicate.
        it('resolves a duplicate seeded id to the last entry and deletes only that one', () => {
            const memory = {
                schema: { name: 'test', id: 'id' },
                database: [
                    { id: 'a', v: 1 },
                    { id: 'a', v: 2 }
                ]
            };
            const table = jsonTable<any>({ name: 'test', key: 'id', memory });

            expect(table.get('a')).toEqual({ id: 'a', v: 2 });

            // Delete removes the cached index (1) via pop, leaving the unreachable duplicate.
            expect(table.delete('a')).toBe(true);
            expect(memory.database).toEqual([{ id: 'a', v: 1 }]);
            // The survivor is no longer addressable: the id field never changed, so no rebuild.
            expect(table.get('a')).toBeNull();
            // It is still reachable through the scoring scan.
            expect(table.find({ v: 1 })).toEqual({ id: 'a', v: 1 });
        });

        // Rows whose id value is null are skipped while indexing (`id != null`), so no id can
        // ever resolve them — they are write-only rows.
        it('keeps a null-id row unaddressable for get and delete', () => {
            const memory = {
                schema: { name: 'test', id: 'id' },
                database: [{ id: null, v: 7 }]
            };
            const table = jsonTable<any>({ name: 'test', key: 'id', memory });

            expect(table.get(null as any)).toBeNull();
            expect(table.delete(null as any)).toBe(false);
            expect(memory.database).toEqual([{ id: null, v: 7 }]);
            // The scan path is the only way to reach it.
            expect(table.find({ v: 7 })).toEqual({ id: null, v: 7 });
        });

        // An `undefined` query value is a real, matchable value: `entry[key]` is `undefined`
        // for every row that lacks the field, so strict === scores a full match on row one.
        it('matches every row for an undefined-valued query key and returns the first', () => {
            const table = jsonTable<any>({ name: 'test', key: 'id' });
            table.add({ id: 'a', v: 1 });
            table.add({ id: 'b', v: 2 });

            expect(table.find({ missing: undefined })).toEqual({ id: 'a', v: 1 });
        });

        // Uniqueness of the auto-generated ids (crypto.randomUUID) across separate add calls:
        // two id-less inserts must land in two distinct addressable rows.
        it('generates a distinct id for every id-less add', () => {
            const table = jsonTable<TestRecord>({ name: 'test', key: 'id' });
            const first = table.add({ name: 'First' } as TestRecord);
            const second = table.add({ name: 'Second' } as TestRecord);

            expect(first.id).toBeDefined();
            expect(second.id).toBeDefined();
            expect(first.id).not.toBe(second.id);
            expect(table.memory().database).toHaveLength(2);
            expect(table.get(first.id as string)).toEqual({ id: first.id, name: 'First' });
            expect(table.get(second.id as string)).toEqual({ id: second.id, name: 'Second' });
        });
    });
});
