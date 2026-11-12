# 0009 - `dataClone` shares Date/Map/Set/RegExp/class instances by reference and overflows the stack on cycles

> **Status:** Open
> **Severity:** Significant
> **Area:** `src/data/clone.ts`
> **Date opened:** 2026-11-04

## Context

`dataClone` is the documented replacement for `JSON.parse(JSON.stringify(x))` in
this workspace ("When To Use What" in the agent guidance, and `knowledge.md`:
"deep clones arrays, plain objects, and primitives recursively… no shared
references"). The module header repeats the promise at `data/clone.ts:8` —
"producing a fully independent copy with no shared references" — and the example
at `:32-37` shows a nested object mutation not affecting the original.

It is independent for arrays and plain objects. For everything else it is the
identity function, and for cycles it does not return at all.

## Gap

**Built-in and class values are returned by reference, at any depth.**
`clone.ts:42-56` dispatches on `typeName` and only implements `array` (`:44`) and
`object` (`:46-53`); `default` (`:55`) returns the value unchanged, and the
comment there ("Primitives and other types are immutable") is the crux of the
bug — a `Map` is not immutable. Measured, nested inside an object:

```ts
const src = { when: new Date(0), tags: new Set(['a']), meta: new Map() };
const copy = dataClone(src);
copy.when === src.when;   // true  — same Date
copy.tags === src.tags;   // true  — mutation leaks into src
copy.meta.set('k', 1);    // src.meta now has 'k'
```

The same applies to `WeakMap`, `RegExp`, boxed primitives, functions, Symbols,
BigInts, and every class instance (verified with `toBe`, including
`instanceof`-preserving identity). A consumer who clones a state object to
snapshot it gets a snapshot that shares every mutable non-plain member — the
exact failure the utility exists to prevent. The plain-object/array branches are
correct, so the surprise only appears for the types the doc does not name.

**A cyclic plain object does not throw a useful error — it dies.**
`:44`/`:50` recurse with no visited set, so `const o = {}; o.self = o`
recurses until the stack overflows. Observable as `RangeError`, which the test
suite now pins, but it is a crash rather than a clone, and nothing in the JSDoc
warns about it.

**The declared cache parameter is unused.** `:19` declares
`dataClone<T>(data, cache?: any[])` and `:16` documents it as "tracking
already-seen references (reserved for future circular-reference support)", while
`:40` does not accept a second parameter and `:39` carries
`TODO: pending - cache param in type signature but not in implementation`. So the
type advertises the one capability the implementation lacks.

**Two quieter losses.** `:47` always builds a bare `{}` and copies with
`objectEach`, which iterates own enumerable **string** keys — so symbol keys and
non-enumerable properties are dropped silently — and a value whose `typeName` is
`''` (a null-prototype object, see
[0006](./0006-typename-empty-sentinel.md)) lands on `default` and is shared by
reference like the built-ins.

## Why it is the way it is

The `default` branch is a deliberate performance choice: cloning `Date`/`Map`
correctly requires per-type handling, and the author chose to treat
"not array, not plain object" as "leaf". Under that rule the implementation is
internally consistent; what is wrong is the header sentence at `:8` and the
`knowledge.md` line that generalize it into "no shared references".

Cycles are the one case the rule cannot rescue, and `:16`/`:39` show the author
already identified the missing visited-set as the fix, with the parameter
designed but never wired.

## Evidence

- `src/data/clone.ts:8` — "producing a fully independent copy with no shared
  references".
- `src/data/clone.ts:16,19` — the documented-but-unused `cache` parameter.
- `src/data/clone.ts:39` — `TODO: pending - cache param in type signature but not
  in implementation`.
- `src/data/clone.ts:40` — `(data) =>`, one parameter.
- `src/data/clone.ts:44-53` — the only two cloning branches (array via `map`,
  plain object via `objectEach` into a fresh `{}`); `:55` `default: ({ value })
  => value`.
- `src/object/each.ts` — `Object.keys`-based iteration, hence the symbol /
  non-enumerable drop from `:48-51`.
- Runtime confirmation from this pass (probed against `dist`, asserted in tests):
  `dataClone({d:new Date(0)}).d === original.d`, same for `Map`/`Set`/`WeakMap`/
  `RegExp`/class instance/boxed primitive/function/Symbol/BigInt/
  `Object.create(null)` and for those values nested inside objects and arrays;
  mutating the cloned `Map` changes the source `Map`; `const o = {a:1}; o.self = o`
  → `toThrow(RangeError)`; a sparse array's holes are preserved; symbol keys are
  absent from the result; integer-like keys come back in ascending order.
- Pinning tests: `src/data/clone.test.ts` — 25 cases; the identity assertions are
  `toBe`-based and each carries a comment naming the type that is shared.

## Proposal

1. **Wire the cache.** Change `:40` to `(data, cache = new WeakMap())`, check
   `cache.has(data)` before recursing in both branches, store the fresh
   container before descending, and return the cached copy for a repeat visit.
   That single change fixes the cycle crash (a cyclic object clones into a cyclic
   copy) and removes the TODO at `:39`. Keep the `Structure` type but express
   `cache` as `WeakMap<object, any>` so it matches the implementation, and make it
   optional and undocumented-for-public-use if the signature must stay stable.
2. **Decide the built-in story, then make doc and code agree.**
   - *Option A (preferred):* keep `default` as pass-through and change `:8` plus
     the JSDoc at `:21-30` to state it precisely — "arrays and plain objects are
     deep-copied; every other value, including `Date`, `Map`, `Set`, `RegExp`,
     functions and class instances, is carried over by reference". Cheap, honest,
     zero behavior risk for the nine consumer packages.
   - *Option B:* add per-type branches for `Date` (`new Date(+v)`), `RegExp`
     (`new RegExp(v.source, v.flags)`), `Map`/`Set` (rebuild, cloning entries),
     and clone class instances via `Object.create(Object.getPrototypeOf(v))` plus
     own-key copy, all routed through the same cache. More useful, but it changes
     results for consumers that *rely* on identity (a state store holding a Map
     handle, a cloned config holding a Date used as a cache key), so it needs a
     workspace-wide audit.
3. Either way, copy symbol keys too (`Reflect.ownKeys` filtered to enumerable) in
   `:48`, or document the string-keys-only rule at `:24-26`.

Alternatives considered and rejected:

- **Delegate to `structuredClone`.** Handles cycles and built-ins natively, but it
  throws on functions and class instances and drops prototypes/methods, which is
  a bigger behavior change than option B — and it is unavailable in some
  jsdom-adjacent runtimes this package targets.
- **Throw explicitly on the first cycle instead of cloning one.** Simpler than a
  WeakMap, but `dataClone` is used on live state trees where a back-reference is
  normal, and "your snapshot crashed" is not a useful answer.

## Acceptance criteria

- A cyclic plain object/array clones successfully, and the clone's cycle points
  at the clone (`copy.self === copy`).
- `dataClone`'s JSDoc and `knowledge.md` state exactly which types are copied and
  which are carried over — no unconditional "no shared references" claim.
- If option B is taken: `Date`/`Map`/`Set`/`RegExp` results are `not.toBe`
  the source and `toBeInstanceOf` the right constructor; class instances keep
  their prototype.
- Symbol/non-enumerable handling matches the documentation.

## Tests to add

`src/data/clone.test.ts`:

- new: `const o: any = { a: 1 }; o.self = o` → clone succeeds, `copy.self === copy`,
  and `copy.a === 1`;
- new: a cyclic array (`arr.push(arr)`) with the same assertions;
- new: mutual cycles across two objects (`a.b = b; b.a = a`);
- new: the same `Date` appearing twice in one tree — with the cache it must
  collapse to a single cloned instance (`copy.x === copy.y` under option B);
- replace the `toThrow(RangeError)` cycle case with the successful-clone
  assertions;
- the built-in identity assertions stay under option A and flip to
  `not.toBe` + `toBeInstanceOf` under option B.

## Out of scope

- Prototype-preserving cloning in general (option B only).
- Detaching functions or Symbols (they are genuinely by-reference in every
  reasonable implementation).
- Performance benchmarks or an iterative (stack-free) rewrite.
- `dataList`'s separate symbol-key and delete-trap problems
  ([0010](./0010-object-module-review-list.md)).
