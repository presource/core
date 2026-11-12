import { test, expectTypeOf } from 'vitest';

import { jsonTable } from '@presource/core';

/**
 * Type-level contract for `jsonTable` (src/json/table.ts).
 *
 * `jsonTable` is a two-overload call signature (module-private support types, so every
 * assertion below is structural):
 *   <T>(config: Configuration<T>) => JsonTableInstance<T>
 *   <T>(tableName: string)        => JsonTableInstance<T>
 * Pinned:
 * - `get`/`find` return `T | null`, `add` takes `Partial<T>` and returns `T`, `delete` returns boolean;
 * - `config().key` is `keyof T & string` — the `${tableName}Id` field the string overload
 *   derives is a RUNTIME value only, it is never a literal in the type;
 * - `memory().schema.id` is `string` (the live identity field, mutable at runtime);
 * - `T` is inferred from `memory` when it is supplied, and otherwise reverse-mapped from the
 *   `key` literal alone, which collapses `T` to `{ [key]: any }`;
 * - an argument that fits neither overload is rejected (TS2769).
 */

type User = { id: string; name: string };

// Structural twin of the private `JsonTableInstance<User>` (Memory/Configuration inlined).
type UserInstance = {
    memory: () => { schema: { name: string; id: string }; database: User[] };
    config: () => {
        name: string;
        key: 'id' | 'name';
        memory?: { schema: { name: string; id: string }; database: User[] };
        onChange?: () => void;
    };
    get: (id: string) => User | null;
    find: (query: { [key: string]: any }) => User | null;
    add: (input: Partial<User>) => User;
    delete: (id: string) => boolean;
};

test('the config overload returns the full instance shape for T', () => {
    const table = jsonTable<User>({ name: 'users', key: 'id' });
    expectTypeOf(table).toEqualTypeOf<UserInstance>();
});

test('the table-name overload and the config overload agree on the instance shape', () => {
    const byName = jsonTable<User>('users');
    const byConfig = jsonTable<User>({ name: 'users', key: 'id' });
    // Both overloads resolve to the same `JsonTableInstance<User>`.
    expectTypeOf(byName).toEqualTypeOf(byConfig);
    expectTypeOf(byName).toEqualTypeOf<UserInstance>();
});

test('CRUD members keep their exact signatures', () => {
    const table = jsonTable<User>('users');
    expectTypeOf(table.get('a')).toEqualTypeOf<User | null>();
    expectTypeOf(table.get).parameter(0).toBeString();
    expectTypeOf(table.find({ id: '1' })).toEqualTypeOf<User | null>();
    expectTypeOf(table.find).parameter(0).toEqualTypeOf<{ [key: string]: any }>();
    expectTypeOf(table.add({ id: '1' })).toEqualTypeOf<User>();
    expectTypeOf(table.add({ id: '1' }).name).toBeString();
    expectTypeOf(table.add).parameter(0).toEqualTypeOf<Partial<User>>();
    expectTypeOf(table.delete('a')).toBeBoolean();
    expectTypeOf(table.memory().schema.id).toBeString();
    expectTypeOf(table.memory().database).toEqualTypeOf<User[]>();
});

test('config().key is keyof T & string, never the runtime-derived `${tableName}Id` literal', () => {
    const table = jsonTable<User>('users');
    expectTypeOf(table.config().key).toEqualTypeOf<'id' | 'name'>();
    // @ts-expect-error TS2322: `usersId` exists only at runtime, the type is `keyof User & string`
    const runtimeIdField: 'usersId' = table.config().key;
    void runtimeIdField;
});

test('T is inferred from `memory`, and otherwise reverse-mapped from the `key` literal alone', () => {
    const withMemory = jsonTable({ name: 'users', key: 'id' as const, memory: jsonTable<User>({ name: 'users', key: 'id' }).memory() });
    expectTypeOf(withMemory.get('id')).toEqualTypeOf<User | null>();
    expectTypeOf(withMemory.config().key).toEqualTypeOf<'id' | 'name'>();

    // Without `memory` the only inference site is `key: keyof T & string`, so T collapses to
    // a synthetic `{ id: any }` — the entry type is NOT the caller's row shape.
    const keyOnly = jsonTable({ name: 'users', key: 'id' as const });
    expectTypeOf(keyOnly.get('id')).toEqualTypeOf<{ id: any } | null>();
    expectTypeOf(keyOnly.config().key).toEqualTypeOf<'id'>();
});

test('arguments that fit neither overload are rejected', () => {
    // @ts-expect-error TS2769: `key` is required by the config overload, and a config object is not a string
    const missingKey = jsonTable<User>({ name: 'users' });
    void missingKey;
    // @ts-expect-error TS2769: a number is neither `Configuration<User>` nor a table name
    const badArgument = jsonTable<User>(42);
    void badArgument;
});

test('add() is a Partial<T> upsert and get() only accepts string ids', () => {
    const table = jsonTable<User>('users');
    // @ts-expect-error TS2353: `nope` is not part of `Partial<User>`
    const excessProperty = table.add({ nope: 1 });
    void excessProperty;
    // @ts-expect-error TS2322: `id` must stay a string
    const wrongIdType = table.add({ id: 42 });
    void wrongIdType;
    // @ts-expect-error TS2345: ids are strings, not numbers
    const missingEntry = table.get(42);
    void missingEntry;
});
