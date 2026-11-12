import { test, expectTypeOf } from 'vitest';

import { objectAlias } from '@presource/core';

/**
 * Type-level contract for `objectAlias` (src/object/alias.ts).
 *
 *   objectAlias: <Data extends ObjectConstant, Alias extends ObjectConstant>(data: Data, alias: Alias) =>
 *       { [key in keyof Data | keyof Alias]: Data[keyof Data] }
 * Pinned:
 * - original keys AND alias keys are present on the result (the alias map's keys become
 *   first-class properties), and the result stays writable;
 * - every value type is the union `Data[keyof Data]` — per-key precision is lost on purpose,
 *   so an alias (and even a real key) accepts any value the data object holds anywhere;
 * - a key outside `keyof Data | keyof Alias` is rejected;
 * - an empty alias map yields exactly the original keys;
 * - `ObjectConstant` (`{ [key: string]: any }`, src/object/constant.ts) rejects primitives.
 */

const data = { name: 'ada', active: true };

test('original and alias keys are merged into one object type', () => {
    const aliased = objectAlias(data, { n: 'name', a: 'active' });
    expectTypeOf(aliased).toEqualTypeOf<{
        name: string | boolean;
        active: string | boolean;
        n: string | boolean;
        a: string | boolean;
    }>();
});

test('every value type widens to the union of all data value types', () => {
    const aliased = objectAlias(data, { n: 'name', a: 'active' });
    // `aliased.name` is NOT narrowed to `string` — the mapped type uses `Data[keyof Data]`.
    expectTypeOf(aliased.name).toEqualTypeOf<string | boolean>();
    expectTypeOf(aliased.n).toEqualTypeOf<string | boolean>();
    expectTypeOf(aliased.active).toEqualTypeOf<string | boolean>();
});

test('aliased keys are writable with any value the data object can hold', () => {
    const aliased = objectAlias(data, { n: 'name' });
    // Documented consequence of the widened value type: both branches type-check.
    aliased.n = 'written through the alias';
    aliased.n = true;
});

test('an empty alias map exposes exactly the original keys', () => {
    expectTypeOf(objectAlias(data, {})).toEqualTypeOf<{ name: string | boolean; active: string | boolean }>();
});

test('a key that is neither a data key nor an alias key is rejected', () => {
    const aliased = objectAlias(data, { n: 'name' });
    // @ts-expect-error TS2339: Property 'zzz' does not exist on the merged alias type
    const unknownKey = aliased.zzz;
    void unknownKey;
});

test('the data argument must satisfy ObjectConstant', () => {
    // @ts-expect-error TS2345: Argument of type 'number' is not assignable to parameter of type 'ObjectConstant'
    const primitive = objectAlias(42, { n: 'name' });
    void primitive;
});
