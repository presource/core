# 0008 - `isEmpty` reports truthy junk as empty and nullish values as non-empty; `isEmptyArray`/`isEmptyObject` throw on `null`

> **Status:** Open
> **Severity:** Significant
> **Area:** `src/is/empty.ts`, `src/is/function.ts`
> **Date opened:** 2026-11-04

## Context

`isEmpty` is the package's answer to "is there anything here?". `knowledge.md`
documents it as "NaN, blank string, empty array/object, falsy" — i.e. falsy
values count as empty. Every nullish-aware helper in the package
(`isInvalid`/`isValid`, `arrayEnsures`, `objectEnsures`, `scriptResolve`) uses the
nullish-or-falsy convention, so a reader expects `isEmpty` to agree with
`isValid`'s opposite.

It does not, for every type outside the four it special-cases.

## Gap

**The fallback branch is inverted relative to the name and the docs.**
`is/empty.ts:37-38` ends the dispatcher with `default: () => !!input` — and the
comment there states the consequence out loud: "truthy values are considered
empty". Measured behavior:

| input | `isEmpty` | what a caller expects |
|---|---|---|
| `null` | `false` | `true` (it is nothing) |
| `undefined` | `false` | `true` |
| `0` | `false` | `true` (doc says "falsy") |
| `false` | `false` | `true` |
| `true` | **`true`** | `false` |
| `new Date(0)` | **`true`** | `false` |
| `/re/`, `new Map()`, `new Set()`, `Promise.resolve()`, `new Error()`, a class instance, a function | **`true`** | `false` |
| `NaN` | `true` | `true` |
| `10n` | **`true`** | `false` |
| `0n` | `false` | `true` (falsy) |

So `isEmpty(new Map())` — a map with entries — is `true`, and `isEmpty(null)` is
`false`. The two halves of the contract are backwards. `''`/`'   '`/`[]`/`{}` do
behave as documented, which is what hides the problem in casual testing.

**`isEmptyArray` and `isEmptyObject` are not null-safe.** Both start with
`let result = true` and immediately iterate
(`is/empty.ts:55` `arrayEach(unknown, …)`, `:77` `objectEach(unknown, …)`), and
neither iterator tolerates `null`/`undefined` — the call throws `TypeError`
(`objectEach` reaches `Object.keys(null)`; `arrayEach` reads `.length` of
`null`). They are also typed `(unknown: any)`, so nothing steers a caller away,
and both accept a non-matching input: `isEmptyArray('abc')` iterates the string's
characters via `arrayEach` and returns `true` only because every single
character is a non-blank string (`isEmpty('a')` → `false`) — so the answer is
`false`, produced by an accident of iteration shape rather than a documented
rule.

**`isFunction` excludes generators.** `is/function.ts:23-25` matches only
`'function'` and `'asyncfunction'` (`:10-11`), so `isFunction(function* () {})`
and `isFunction(async function* () {})` are `false` — while the JSDoc at `:17-18`
says it covers "both traditional and async function declarations" and the
sibling `isFunctionAsync` (`:36-37`) has the same gap for async generators.
Downstream, anything gated on `isFunction` skips generators, including
`objectTrigger`, `stringSwitch` (`:79`) and `functionQueue`'s item handling.

## Why it is the way it is

`isEmpty` is *documented* this way at `:22` ("**default**: truthy/falsy
evaluation of the raw value") and `:37`, so the inversion is a deliberate
decision by the author, not a typo — most likely "empty" was meant in the
"nothing to iterate" sense, which for a non-iterable collapses to falsiness. The
problem is that `!!input` is the *inverse* of that intuition for objects: a Date
is not iterable-but-empty, it is simply not a container, and reporting it `empty`
erases the distinction the function name claims to make.

The two helpers have no null guard because they are the leaf implementations the
`isEmpty` dispatcher calls, and the dispatcher itself never hands them `null`
(`null` goes to `default`). Their throw only appears when they are called
directly — which the barrel does expose (`is/index.ts` re-exports all three).

`isFunction`'s name set is engine-type-name based, and generator type names
(`'generatorfunction'`, `'asyncgeneratorfunction'`) were simply not in scope when
`:10-11` was written.

## Evidence

- `src/is/empty.ts:27-39` — the dispatcher; `:22` documents the truthy fallback;
  `:37-38` `default: () => !!input`.
- `src/is/empty.ts:30-36` — `number` → `isNaN`, `string` → `trim() === ''`,
  `array` → `isEmptyArray`, `object` → `isEmptyObject`.
- `src/is/empty.ts:51-60` — `isEmptyArray` iterates with no guard (`:55`).
- `src/is/empty.ts:72-82` — `isEmptyObject` iterates with no guard (`:77`).
- Inherited throws: `src/object/each.ts` (`Object.keys` of the argument),
  `src/array/each.ts` (reads `length`).
- `src/is/function.ts:10-11,23-25,36-37` — the two-name allow-list.
- Interaction with 0006: a null-prototype object resolves to the `null` case in
  `typeSwitch`, so `isEmpty(Object.create(null))` also lands on `default` →
  `true` ("empty") even though it has own properties.
- Pinning tests: `src/is/empty.test.ts` — 15 cases covering the full recursive
  matrix plus the two `TypeError` throws and the `10n`/`0n` split;
  `src/is/function.test.ts` — generators, async generators, bound functions,
  static methods.

## Proposal

1. Decide the contract and write it in one sentence: **empty = nothing
   meaningful to read.** Concretely, replace `is/empty.ts:38` with
   `default: () => !input` (nullish, `0`, `false`, `NaN` → `true`; objects,
   functions, dates, symbols, non-zero numbers → `false`), keeping the four
   special-cased branches as they are, and update `:22` and `knowledge.md`.
2. Add the nullish fast path explicitly at the top of `isEmpty`
   (`if (isInvalid(input)) return true;`) so the answer does not depend on which
   `typeSwitch` bucket a value falls into (this also fixes the null-prototype
   interaction above, whatever 0006 decides).
3. Guard the two helpers: `isEmptyArray(nonArray)` and
   `isEmptyObject(nonObject)` should return `true` for nullish input and
   `false` for a value of the wrong shape, rather than throwing. If throwing is
   kept as the "you passed the wrong type" signal, change the parameters from
   `any`/`unknown` to `unknown[]` and `object` so TypeScript catches it, and
   document the throw.
4. `is/function.ts:10-11` — add `'generatorfunction'` and
   `'asyncgeneratorfunction'` to the sync set, and `'asyncgeneratorfunction'` to
   the async set (or document generators as out of scope in `:17-18`).

Alternatives considered and rejected:

- **Split into `isBlank` / `isEmptyCollection` / `isFalsy` and deprecate
  `isEmpty`.** Cleanest, but `isEmpty` is one of the most-referenced helpers in
  `knowledge.md` and across the workspace; a rename is a coordinated
  multi-package change, not a core fix.
- **Leave `default: () => !!input` and only document it.** Then
  `isEmpty(null) === false` and `isEmpty(new Date()) === true` both stay, and the
  package keeps shipping a predicate whose two most common inputs give opposite
  answers to its name.

## Acceptance criteria

- `isEmpty(null)`, `isEmpty(undefined)`, `isEmpty(0)`, `isEmpty(false)`,
  `isEmpty(NaN)`, `isEmpty('')`, `isEmpty('  ')`, `isEmpty([])`, `isEmpty({})`
  are all `true`.
- `isEmpty(true)`, `isEmpty(1)`, `isEmpty(new Date())`, `isEmpty(new Map([['a',1]]))`,
  `isEmpty(() => {})`, `isEmpty(new Error())`, `isEmpty(10n)` are all `false`.
- The recursive array/object rules are unchanged (`[[]]` → `true`,
  `[null]` → depends on the chosen nullish rule and must be stated in the tests),
  `{a:{b:[]}}` → `true`, `{a:0}` → `false`.
- `isEmptyArray(null)` / `isEmptyObject(undefined)` no longer throw (or the throw
  is typed and documented).
- `isFunction(function* () {})` is `true` (or documented as false).

## Tests to add

`src/is/empty.test.ts`:

- flip the rows for `null`, `undefined`, `true`, `0`, `false`, Date/RegExp/Map/
  Set/Promise/Error/class/function, and both BigInt values, to the new table;
- replace the two `toThrow(TypeError)` cases with exact `true`/`false` results
  (or keep them and tighten the parameter types, in which case add the `@ts-expect-error`
  comments that prove the type guard works);
- new: `isEmpty(Object.create(null))` with own properties (cross-link 0006).

`src/is/function.test.ts`:

- flip the generator/async-generator expectations; keep the bound-function,
  static-method and `Object`/`Symbol.iterator` cases.

## Out of scope

- Renaming `isEmpty` or splitting it into three predicates.
- Changing `isInvalid`/`isValid` semantics (they are correct and narrow).
- Adding a `isEmptyString`/`isEmptySet` family.
- Collection-size semantics ("empty" = zero entries) for Map/Set, which would be
  a new contract rather than a fix.
