# 0006 - `typeName`'s `''` sentinel is shared by `null`, `undefined`, null-prototype objects and anonymous-class instances

> **Status:** Open
> **Severity:** Significant
> **Area:** `src/type/name.ts`, `src/type/switch.ts`, `src/to/string.ts`, `src/object/ensures.ts`, `src/is/object.ts`
> **Date opened:** 2026-11-04

## Context

`typeName` is the dispatcher key for the whole package: `typeSwitch`,
`typeSwitchAsync`, `arrayCreate`, `objectEnsures`, `objectExtract`, `objectMerge`,
`jsonUpdate`, `dataClone`, `booleanPartial*`, `toString` and the wrapper methods
all branch on it. `knowledge.md` documents it as "Returns the lower-case
constructor name of a value" with a table that says
`typeName(null)` → `'null'` and `typeName(undefined)` → `'undefined'`.

The implementation returns the **empty string** for both, and `typeSwitch`
rescues the case afterwards by guessing which of the two was meant. That rescue
is where four different runtime shapes get collapsed into one bucket.

## Gap

`typeName` cannot distinguish four shapes, and the recovery in `typeSwitch`
picks the wrong one for two of them:

```ts
typeName(null)                          // ''  (docs say 'null')
typeName(undefined)                     // ''  (docs say 'undefined')
typeName(Object.create(null))           // ''  — no constructor
typeName(new (class {})())              // ''  — anonymous class instance
```

- `type/switch.ts:86-87` resolves the ambiguity as
  `name = input === undefined ? 'undefined' : 'null'`. So **every** value with a
  missing constructor is treated as `null`:
  - `typeSwitch(Object.create(null), { null: … })` takes the **`null`** case;
  - `toString(Object.create(null))` returns the string `'null'`
    (`to/string.ts:18-27`, because the `null` case is what matches);
  - `objectEnsures(Object.create(null))` returns `{ null: <that object> }`
    (`object/ensures.ts:27` keys the result by the resolved type name) instead of
    returning the object as documented ("plain object ⇒ as-is");
  - an instance of an anonymous class is dispatched as `null` too.
- `is/object.ts` uses constructor identity, so the collapse shows up there in the
  opposite direction: `isObject(Object.create(null))` is **`false`** while
  `isObject(Math)` (a namespace object, not a plain object) is **`true`**. Two
  different definitions of "object" therefore disagree exactly on the shapes
  `typeName` cannot name.
- Callers that follow the documented contract — `if (typeName(x) === 'null')` —
  are wrong, because the function returns `''`. The only correct nullish test
  today is `isInvalid`/`isValid`, which is what most modules in this package do
  use.
- `knowledge.md`'s table remains wrong after this pass, so the next reader hits
  the same cliff.

## Why it is the way it is

`type/name.ts:14` is a one-liner built on `typeConstructor(value)?.name`, and
`?.` is what produces `''` for `null`/`undefined` — the fallback exists to avoid
throwing on nullish input, not to name it. `typeSwitch` then has to map the
sentinel back onto case keys, and `:86-87` does that with the cheapest possible
test.

Keeping `''` also means "no discoverable type", which is arguably the right
answer for a null-prototype object; the bug is the silent `null` substitution
downstream, not the empty string itself.

## Evidence

- `src/type/name.ts:14` — `export const typeName = (value: any) =>
  (typeConstructor(value)?.name || '').toLowerCase();`
- `src/type/switch.ts:86-87` — `if (name === '') { name = input === undefined ?
  'undefined' : 'null'; }`
- `src/to/string.ts:18-27` — `toString` dispatches on `typeName`, with `object`
  and `array` mapped to `JSON.stringify` and no branch for a null-prototype
  object; the resolved bucket for such a value is `null`.
- `src/object/ensures.ts:27` — the `object` case returns the value as-is;
  everything else is keyed by `typeName(…)`.
- `src/is/object.ts` — constructor-identity check (`constructor === Object`).
- Runtime confirmation from this pass (probed against `dist` and asserted in
  tests): `typeName(null) === ''`, `typeName(undefined) === ''`,
  `typeName(Object.create(null)) === ''`, anonymous-class instance → `''`,
  `Object.create(new (class Foo {})())` → `'foo'` (the inherited name is picked
  up), `Math` → `'object'`, `typeSwitch(Object.create(null), { null: () =>
  'NULLCASE', undefined: () => 'U', default: () => 'D' })` → `'NULLCASE'`.
- Pinning tests: `src/type/name.test.ts` (empty-string rows, null-prototype and
  anonymous-class cases), `src/type/switch.test.ts` (the `null`-case routing),
  `src/to/string.test.ts` (`toString(Object.create(null)) === 'null'`),
  `src/object/ensures.test.ts`, `src/is/object.test.ts` (`Math` vs null-proto).

## Proposal

Two coherent options; the package must pick one because the sentinel is
exported-API-level.

**A — make `typeName` total (preferred, but breaking).**
Return `'null'` for `null` and `'undefined'` for `undefined` at
`type/name.ts:14`, keep `''` (or add `'unknown'`) for values with a missing
constructor, and delete the guess at `type/switch.ts:86-87`. `typeSwitch` then
matches the documented case keys exactly, `toString` and `objectEnsures` fall out
correctly, and `knowledge.md` becomes true. Consumer audit required: grep shows
`typeName` compared against literals in this package (`json/update.ts:33`,
`boolean/cases.ts`, `data/clone.ts`, `object/ensures.ts`), so the change is
mechanical inside `@presource/core` but should be checked in
`@presource/nexus`/`@presource/structure`/`@presource/node`.

**B — keep `''`, resolve by value instead of by name.**
Replace `type/switch.ts:86-87` with explicit `input === null` /
`input === undefined` checks *before* the name lookup, and route anything else
whose name is `''` to `default`. `toString`, `objectEnsures` and `isObject` then
need the same null-prototype branch (or a shared `typeIsPlainObject` helper). No
consumer-visible change except that null-prototype objects stop looking like
`null`.

Either way: add a `typeSwitch` case key for anonymous-class instances, or accept
that they are indistinguishable and say so in `knowledge.md`.

Alternatives considered and rejected:

- **`typeof`-based naming.** Rejected: it would break `'array'`, `'null'` and the
  class-instance names the package already relies on.
- **Just fix `knowledge.md`.** Cheapest, but it leaves `objectEnsures` producing
  `{ null: obj }` — a data-shape bug, not a doc bug.

## Acceptance criteria

- `typeName(null)`, `typeName(undefined)` match whatever option is chosen, and
  `knowledge.md`'s table matches the implementation.
- A null-prototype object is not reported as `null` by `typeSwitch`, and
  `objectEnsures(Object.create(null))` returns an object keyed by content (or the
  value itself), not `{ null: … }`.
- `toString(Object.create(null))` no longer returns `'null'` (option A) **or** the
  behavior is explicitly documented (option B).
- `is/object.ts` and `type/name.ts` agree on at least: plain objects, arrays,
  null-prototype objects.

## Tests to add

`src/type/name.test.ts`, `src/type/switch.test.ts`, `src/to/string.test.ts`,
`src/object/ensures.test.ts`, `src/is/object.test.ts` — all five currently pin
the collapsed behavior; each pinning assertion is marked with a comment naming
this issue so the flips are visible in one diff:

- null-prototype rows for `typeName`/`typeSwitch`/`toString`/`objectEnsures`;
- new: an anonymous-class instance vs a named-class instance pair;
- new: `Object.create(new Foo())` (inherited name) vs `Object.assign(Object.create(new
  Foo()), { x: 1 })` to show the name still leaks through the prototype chain.

## Out of scope

- Renaming `typeName`/`typeSwitch`.
- Making `isObject` structural (deep "is this a plain object" semantics).
- Class-instance cloning (that is
  [0009](./0009-dataclone-reference-sharing-and-cycles.md)).
- Nested-delegation gaps inside `typeSwitch`
  ([0007](./0007-typeswitch-delegation-gaps.md)).
