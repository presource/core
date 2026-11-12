# 0010 - `object/*` review list: null-prototype hazards, reference aliasing, sentinel collisions, surprising traps

> **Status:** Open — for the package owner to triage
> **Severity:** Review list
> **Area:** `src/object/*`, `src/data/list.ts`, `src/json/update.ts`
> **Date opened:** 2026-11-04

Everything below was found in the same review pass as issues 0001-0009. Each row
is a single behavior with a `path:line` reference and a suggested action; none of
them is large enough to deserve its own issue file, and several are defensible as
designed. All of them are **pinned by tests now**, so any change will show up as
a visible test diff rather than a silent regression.

Priority vocabulary: **P1** — a consumer can be silently corrupted or hit a
`TypeError` on a realistic input; **P2** — worth scheduling, low blast radius;
**P3** — tidy-up or documentation.

## Reference and mutation contracts

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P1 | `objectMerge` stores an incoming nested value **by reference** whenever the accumulator has no mergeable object at that key (the guard returns `value` itself, and every non-object case does too), so the "new" merged object can share a subtree with one of its inputs — mutating `merged.a.b` then mutates the source. The top level is a fresh object (`:24`), which is what hides it. | `src/object/merge.ts:24,30-41` (`:36` and `:41` return the incoming value untouched); pinned in `src/object/merge.test.ts` | Either deep-copy the incoming branch, or state "values are copied by reference unless both sides are plain objects" in the JSDoc and `knowledge.md`. |
| P1 | `jsonUpdate` mutates `primaryObject` in place and returns it, and any key that `secondaryObject` introduces is aliased from `secondary`. The header already carries the author's own TODO. | `src/json/update.ts:28` (`TODO: pending - BUG: let result = primaryObject mutates original. Should clone first`), `:29-49`; identity assertions in `src/json/update.test.ts` | Decide once: clone-then-merge (breaking) or keep in-place and rename the promise in the JSDoc from "The merged result (a new or updated reference)" (`:26`) to "the mutated primary". |
| P1 | `objectRegistry` uses `value === undefined` as the "this is a read, not a write" sentinel, so `undefined` cannot be stored: `registry('k', undefined)` reads and the stored value stays absent. | `src/object/registry.ts:65`; pinned in `src/object/registry.test.ts` | Distinguish by argument count (`arguments.length`) or an explicit `{ value }` write form; document that `undefined` is not a storable value either way. |
| P2 | `objectFill` writes missing keys into the target (mutating it) **and** returns a shallow copy (`{ ...object }`), so the caller's result and the mutated input are two different objects that share every nested value. Legal, easy to misuse. | `src/object/fill.ts:19-25` (mutate at `:22`, copy at `:25`); pinned in `src/object/fill.test.ts` | Pick one — mutate-and-return-the-same-reference matches `objectUpdate` at `src/object/update.ts:25` — or document the double reference explicitly. |
| P2 | `objectObserve` mutates on **read**: `:65` writes `item[key] = nested` on every `get`, where `nested` is `{}` when the key was absent (`:61`) — so reading a missing key creates it, and reading an inherited key (`constructor`) copies the inherited value onto the target as an own property. A pure inspection changes the observed object. | `src/object/observe.ts:50,53-70`; pinned in `src/object/observe.test.ts` (including the exact event lists) | Make the materialization lazy (only on `set`), or document "reads are not side-effect free" in the JSDoc and `knowledge.md`, since `dataList` is built on top of it. |
| P2 | `objectScan`'s callback receives a copied `path` (`:55`) that it may mutate, and the mutation leaks into the recursion: the child path is rebuilt from that same array (`:72`) and then gets the key appended again (`:74`), producing `['a','a']` at one level of nesting. A replaced subtree is also silently skipped by the guard at `:70`. | `src/object/scan.ts:55,70-76`; pinned in `src/object/scan.test.ts` | Freeze the callback's `path` (or hand over a second copy), and document that a replacement stops recursion. |
| P3 | `objectTrigger` merges an **object** return into the output and discards every other return, so a triggered key disappears from the result unless the handler returns a plain object. Arrays and primitives are dropped too. | `src/object/trigger.ts:58-60`; pinned in `src/object/trigger.test.ts` | Accept arrays as replacement values, or document "return a plain object to contribute to the output". |
| P3 | `objectUpdate` has no guard: a `null`/`undefined` update source throws `TypeError` from `objectEach`. | `src/object/update.ts:20-25` (throw origin at `src/object/each.ts:42`, `Object.keys(null)`); pinned in `src/object/update.test.ts` | Return the target unchanged for a nullish update. |

## Null-prototype and prototype-chain hazards

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P1 | `objectHasKey` calls `object.hasOwnProperty(key)` on the receiver, so it throws `TypeError: <recv>.hasOwnProperty is not a function` for a null-prototype object (and on `null`/`undefined`). It is the guard used by `stringSwitch` and `objectSwitch`, both of which accept arbitrary user objects. | `src/object/has.ts:15`; pinned in `src/object/has.test.ts` | Use `Object.prototype.hasOwnProperty.call(object, key)` plus an `isInvalid(object)` early return. Zero behavior change for existing callers. |
| P1 | `objectAlias` resolves an alias with `alias[key] || key`, which (a) lets an inherited `Object.prototype` member on the alias map hijack a lookup — asking for `toString` yields `alias.toString`, a function, so the real `data.toString` is shadowed and the read returns `undefined` — and (b) silently degrades a `''` alias target to identity. | `src/object/alias.ts:36`; pinned in `src/object/alias.test.ts` | Use `objectHasKey(alias, key) ? alias[key] : key` and keep `''` as an explicit miss. |
| P2 | `objectEnsures` keys its result by the resolved type name (its `default` branch), so a null-prototype object becomes `{ null: <obj> }` instead of the object itself. Root cause is the shared `typeName` sentinel, not this function. | `src/object/ensures.ts:25-31` (the `object` passthrough is `:31`, and a null-prototype value never reaches it); cross-reference [0006](./0006-typename-empty-sentinel.md); pinned in `src/object/ensures.test.ts` | Fix once at `type/switch.ts`, then update this test. |
| P3 | `objectSwitch` and `objectEach` throw on a `null`/`undefined` input (`Object.keys` of null). Reasonable, but currently expressed only as a thrown engine message pinned by substring in the tests. | `src/object/each.ts:42` (`const array = Object.keys(object)`), `src/object/switch.ts:52-55`; pinned in `src/object/each.test.ts`, `src/object/switch.test.ts` | Add an explicit `isInvalid` guard with a named error message so the tests can assert text instead of an engine string. |
| P3 | `objectSwitch` builds reloop closures for **every** case key including `default`, and a self-reloop (`params.<sameKey>()`) recurses without a base case — observed `RangeError: Maximum call stack`. A non-callable case value reached through a reloop throws `TypeError`. | `src/object/switch.ts:52-55` (reloop construction) and `:71` (the matched invocation); recursion left unpinned deliberately (engine-dependent message) | Exclude the matched key from its own reloop set, or route a self-reloop to `default`. |

## Proxy traps

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P1 | With a `set` trigger installed, `objectProxy` **never performs the assignment itself** — it returns `isInvalid(result) ? true : result`. So a trigger returning `true` or a string silently discards the write, and a trigger returning `false` throws `TypeError` in strict mode ("'set' on proxy: trap returned falsish"). The `as any` cast hides the type error. | `src/object/proxy.ts:91-95,99` (assignment only on the no-trigger path); pinned in `src/object/proxy.test.ts` | Return `true` unless the trigger explicitly returns `false`; treat a non-boolean return as the value to assign (which is what a "spy and rewrite" trigger wants), and tighten the cast. |
| P1 | `dataList` has no `deleteProperty` trap: `delete list.topKey` reports success but leaves the source entry intact (the delete lands on the internal handler function used as the proxy target), and no structure callback fires. | `src/data/list.ts` (proxy construction) + `src/object/proxy.ts` (no `deleteProperty` support at all); pinned in `src/data/list.test.ts` | Add `deleteProperty` to `objectProxy`'s trigger set and forward it in `dataList`, or document deletion as unsupported. |
| P2 | `dataList` computes its callback payload with `path.join('.')` and `path.splice(1)`: a symbol key throws `TypeError: Cannot convert a Symbol value to a string` **after** the value has already been written to the source, and `splice` mutates the observer's own path array in place. Root-level, array-valued and numeric-key writes resolve the pointer to `''` and the structure callback is skipped silently. | `src/data/list.ts:125-126`; pinned in `src/data/list.test.ts` | Stringify keys explicitly (`toString(key)`), copy the path before slicing (`path.slice(1)`), and define what happens for a non-string key instead of throwing mid-write. |
| P3 | `objectObserve`'s nested wrapper is recreated on every read, so `obs.a === obs.a` is `false`. Expected for a proxy factory, but it breaks identity comparisons consumers may rely on in `useEffect` deps etc. | `src/object/observe.ts:55-70`; pinned in `src/object/observe.test.ts` | Document, or memoize per (target, key). |

## Unimplemented

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P2 | `objectPopulate` is a stub: it ignores both arguments and returns `undefined`. The name promises a reference-population helper (populate an object's id fields from a map). | `src/object/populate.ts` (whole file); pinned by "returns `undefined` (implementation incomplete)" in `src/object/populate.test.ts` | Implement, or remove the export and let the two consumer call sites fail at compile time rather than runtime. |
| P2 | `objectResolve` is a stub: it iterates the keys of its argument and returns `{}`. The name suggests template/`{{path}}` resolution. | `src/object/resolve.ts:19-33` (pre-existing TODO inside); pinned in `src/object/resolve.test.ts` | Same choice as `objectPopulate`. Note both are re-exported from `src/object/index.ts`, so they are public API. |
| P3 | `ObjectConstant` (`src/object/constant.ts:3`) is a type-only export that `src/object/index.ts:6-28` does not re-export, so it is unreachable from the package root. | `src/object/constant.ts:3`; asserted absent in `src/object/index.test.ts:22-27` | Export it from the barrel, or delete the file — an unreferenced type with no import site is dead surface. |

## Out of scope for this list

- `dataClone`'s reference sharing and cycles
  ([0009](./0009-dataclone-reference-sharing-and-cycles.md)).
- The `typeName` sentinel that several rows above depend on
  ([0006](./0006-typename-empty-sentinel.md)).
- `objectFlatten`/`objectUnflatten` round-trip lossiness, which is documented in
  the source and pinned in `src/object/unflatten.test.ts` as expected behavior.
- `objectTransform`'s fixed-point iteration (correct and pinned, including the
  self-referencing-rule break).
