# 0011 - Cross-cutting review list: dead branches, signature drift, doc drift, type-contract losses, `TODO` inventory

> **Status:** Open — for the package owner to triage
> **Severity:** Review list
> **Area:** cross-cutting (`src/**`, `knowledge.md`, `vitest.config.ts`)
> **Date opened:** 2026-11-04

Findings from the 2026-11-04 review pass that are not module-level bugs: code
that cannot execute, signatures that lie about return values, `knowledge.md`
statements the implementation contradicts, public types that never reach a
consumer, and the complete inventory of `TODO: pending` markers. All of it is
pinned or named in the test suite, so any action below shows up as a reviewable
diff.

Priority vocabulary: **P1** — a consumer or a future maintainer is actively
misled; **P2** — worth scheduling; **P3** — tidy-up.

## Unreachable code and dead branches (P1)

These are the only three uncovered branches left in the package (Branches
99.27%, 413/416). Each was proved unreachable by construction, not left over by
an incomplete test file, so **coverage cannot rise without deleting the branch**.

| Item | Evidence | Suggested action |
|---|---|---|
| `functionState`'s `triggers[triggerIndex] \|\| {}` fallback can never take the `{}` side: every entry on the stack is pushed as an object (`:95`) or is the trigger assigned at `:46`, and the enclosing `if (triggers.length)` at `:41` is the guard that actually protects the code. | `src/function/state.ts:41,43,46,95`; documented in the header of `src/function/state.test.ts`, which pins the reachable `:41` guard instead | Delete the `\|\| {}` and let the type say so, or add a comment stating the invariant. |
| `objectExtract`'s `indexes.match(/\d+/g) ?? []` nullish side is unreachable: `indexes` is captured by `/^([^\[]*)((?:\[\d+\])*)$/` (`:26`), so it is either `''` (line `:37` skips the block) or a non-empty `[0][1]` run that always matches `/\d+/g`. | `src/object/extract.ts:26,37-38,41`; multi-step bracket tests now cover line `:38` itself (`src/object/extract.test.ts`) | Replace with `indexes.match(/\d+/g)!` plus a comment on why it cannot be null, or drop the `?? []`. |
| `taskCompletion.add`'s `if (!completed) run()` at `:85` has a false-branch that can never be taken, because `:83` (`if (completed) completed = false;`) has just cleared the flag. v8 branch counts for this line in the current suite: `[52, 0]`. | `src/task/completion.ts:83,85`; noted in a comment at the end of `src/task/completion.test.ts` | Collapse `:83-85` into a single `completed = false; run();`, or make the guard meaningful by moving the reset after the check. |

## Signature and return-type drift (P1)

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P1 | `toString` is declared `(…input: any[]) => string` but returns **`string[]`** for two or more arguments. The package's own TODO says so; consumers written against the signature will assign an array to a `string`. | `src/to/string.ts:18` (signature), `:34` (TODO), `:36` (`input.map(…)`); pinned in `src/to/string.test.ts` and `src/to/index.test.ts` | Split into `toString(value)` and `toStringAll(…values): string[]`, or change the return type to `string \| string[]`. |
| P1 | `jsonStringify` is declared `(item: any) => string` but returns `undefined` (not a string) for a top-level `undefined`, `Symbol` or function — it forwards `JSON.stringify`'s behavior. | `src/json/stringify.ts:52` (signature), `:57,87` (replacer returns `undefined`); pinned in `src/json/stringify.test.ts` | Return `string` by coercing the `undefined` cases (`?? 'undefined'`) — a behavior change — or type it `string \| undefined`. |
| P1 | `isBooleanTrue` / `isBooleanFalse` are documented as strict checks but do not narrow: no `value is true` / `value is false` predicate, so `if (isBooleanTrue(x))` leaves `x` as `any`. Two TODOs already ask for it. | `src/is/boolean.ts:25-26,34-35` | Add the predicates — pure type change, no runtime risk. |
| P2 | `stringIncludes`'s `Structure` return type is `{ [key in keyof T]: any }` (every case key present) while the function only emits the **matched** keys. | `src/string/includes.ts:55` (TODO), `:56-67`; pinned by the "unmatched keys absent" case in `src/string/includes.test.ts` | Type it `Partial<{ [key in keyof T]: any }>` and close the TODO. |
| P2 | `array/wrapper/index.ts`'s `Params` type declares the `w`/`e`/`c`/`i` aliases, and the get trap never populates them — a custom extension receives `undefined` for all four. | `src/array/wrapper/index.ts:38-44` vs `:125-130`; pinned in `src/array/wrapper/index.test.ts` (`aliases → undefined`) | Part of [0005](./0005-array-wrapper-filter-sharing.md) item 5 — delete or implement. |
| P3 | `functionControl`'s excluded-property list is hard-coded (`name`, `prototype`, `displayName`) and not configurable, and Symbol keys *are* intercepted while assignments bypass the callback entirely. | `src/function/control.ts:38` (TODO); pinned in `src/function/control.test.ts` | Make the exclusion list an option, or document it as fixed. |
| P3 | `functionCurry` fires only when `args.length === fn.length`, so over-application never fires and `(...rest)`/default-parameter functions are effectively uncurriable. Documented by a TODO, surprising in practice. | `src/function/curry.ts:29` (TODO), `:31`; matrix pinned in `src/function/curry.test.ts` | Use `args.length >= fn.length`, or document "arity-exact only". |
| P3 | `functionProxy` shares its `throughGetQuery`/`currentKey` closure between every proxy created from one `functionProxy` call, so a property read on proxy B can attach a key to a call made on proxy A. | `src/function/proxy.ts:35` (TODO); pinned by the multi-proxy case in `src/function/proxy.test.ts` | Move the state per-proxy as the TODO says. |
| P3 | `functionChain` has no `set` case, so `chain.x = 1` throws ("'set' on proxy: trap returned falsish"), and `pending.callback()` is invoked with no arguments on `.get` while it receives `params` elsewhere. | `src/function/chain.ts:87,106` (TODO); pending-callback payloads pinned in `src/function/chain.test.ts` | Add a `set` case (or make the proxy target writable) and unify the pending call signature. |
| P3 | `functionDelay` exposes no cancel handle, so a self-rescheduling callback cannot be stopped from outside. | `src/function/delay.ts:16` (TODO); reschedule behavior pinned in `src/function/delay.test.ts` | Return the timer handle (breaking) or a `{ cancel() }` controller. |
| P3 | `scriptAsync`'s `configs` parameter is typed `{}` and never read; `dataList` accepts a `request` parameter it never uses meaningfully. | `src/script/async.ts:19` (TODO), `src/data/list.ts:143` (TODO) | Remove the parameters or implement them; both are public surface. |

## `knowledge.md` drift (P1)

`knowledge.md` is the file agents and consumers read first; every item below is a
statement in it that the implementation contradicts. All fixes are documentation
unless a linked issue says otherwise.

| Item | `knowledge.md` says | Implementation does | Action |
|---|---|---|---|
| `typeName` | `typeName(null)` → `'null'`, `typeName(undefined)` → `'undefined'` (`knowledge.md:88-92`) | both return `''` (`src/type/name.ts:14`); `typeSwitch` guesses the difference afterwards (`src/type/switch.ts:86-87`) | Fix the table, or fix the function ([0006](./0006-typename-empty-sentinel.md)). |
| Constants | `EMPTY_STRING`, `SPACE_STRING`, `NUMBERS_STRING`, `ALPHABET_STRING`, `NULL_STRING`, `UNDEFINED_STRING` (`knowledge.md:74-75,390-399`) | they exist **as of this pass** — previously `src/constants/index.ts` was 0 bytes and the folder was not re-exported | Nothing; the doc is now correct. See [0012](./0012-applied-fixes-2026-11.md). |
| `isEmpty` | "`isEmpty('')`, `isEmpty([])`, `isEmpty({})` → true" plus "falsy ⇒ empty" (`knowledge.md:129-131`) | `isEmpty(null)`/`isEmpty(0)`/`isEmpty(false)` → `false`, `isEmpty(true)`/`isEmpty(new Date())` → `true` (`src/is/empty.ts:37-38`) | Rewrite the section around the real rule ([0008](./0008-isempty-semantics-and-null-safety.md)). |
| `dataClone` | "deep clones arrays, plain objects, and primitives… no shared references" (`knowledge.md:346`) | Date/Map/Set/WeakMap/RegExp/class/boxed/function/Symbol/BigInt are returned by reference at any depth, and cycles overflow (`src/data/clone.ts:42-56`) | State the pass-through set ([0009](./0009-dataclone-reference-sharing-and-cycles.md)). |
| `loopUntil` | "loop until the condition is met" (`knowledge.md:362`) | it is `while (!condition)`, so the body runs **zero** times when the condition starts true, and it returns `undefined` (`src/loop/until.ts:58,67`) | Document zero-run and the void return ([0004](./0004-loop-result-contracts.md)). |
| `scriptChain` | "returns a relay you can await" (`knowledge.md:372`) | the top-level value is a plain function; only a method call returns the awaitable relay (`src/script/chain.ts:61-63,77,99-100`) | Fix once 0003 decides. |
| `arrayCreate` | "number ⇒ fixed length filled with `undefined`" (`knowledge.md:212`) | also true for `2.7`/`-3`/**`NaN`** only after this pass; `Infinity` still grows until `RangeError` (`src/array/create.ts:71`) | Add the non-integer/negative/`Infinity` rows. |
| `promise` module | `promise/index.ts:2-5` describes "accessing the native Promise constructor through a centralized constant" | the barrel only re-exports `./create` (`src/promise/index.ts:10`) — no such constant exists | Delete the sentence. |
| `arrayWrapper` | lists the nine methods as a chainable facade | `select`'s request types, the shared filter array, and the `random`/`retain` filter mismatch | Fold in the fixes from [0005](./0005-array-wrapper-filter-sharing.md). |

## Public type contracts that never reach a consumer (P2)

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P2 | `ClassConstructor` and `ClassCreate` are declared without `export`, so the class helpers' generic contracts are invisible through the barrel (runtime is fine). | `src/class/constructor.ts:1`, `src/class/create.ts:4` | `export type` both. |
| P2 | Every loop helper keeps its `Argument` / `Callback` / `Condition` / `Structure` types private, so a consumer cannot annotate a saved callback and gets no help from the compiler on the payload shape. | `src/loop/for.ts:21,36,47,110`, `src/loop/until.ts:22,36,45`, `src/loop/while.ts:20,34,43` | Export the `Argument` types (they are the documented payload). |
| P2 | The `arrayWrapper` extension surface types (`ExtendList`, `ExtendFunction`, `WrapperFunction`, `Returned`, `Structure`) are private, so a custom-callback wrapper cannot be typed by a consumer. | `src/array/wrapper/index.ts:52,58,64,72,103` | Export `ExtendList`/`ExtendFunction`/`Returned` at minimum. |
| P3 | `ObjectConstant` is type-only **and** not re-exported by the object barrel, so it is unreachable from the root. | `src/object/constant.ts:2`; asserted absent in `src/object/index.test.ts` | Export it or delete the file (see [0010](./0010-object-module-review-list.md)). |
| P3 | `objectExtract`'s `number` request case is declared in the JSDoc but unimplemented (returns `undefined`), with a TODO asking what it should do. | `src/object/extract.ts:53,63` (TODO); pinned by the "number → `undefined`" cases in `src/object/extract.test.ts` | Decide and implement, or remove the documented case. |

## Barrel surface risks (P2)

| P | Item | Evidence | Suggested action |
|---|---|---|---|
| P2 | `array/wrapper/methods/is.ts` exports a **`isFunction`**, the same name `src/is/function.ts:23` exports. Today nothing collides only because `array/wrapper/index.ts` imports it privately; re-exporting `./methods` from that barrel would silently drop one at the root (`export *` ties are excluded, not merged). | `src/array/wrapper/methods/is.ts:39` vs `src/is/function.ts:23`; verified collision-free today by the root list in `src/index.test.ts` (97 names, hand-derived) | Rename the wrapper-local one (e.g. `isConditionFunction`) before anyone re-exports the methods folder. |
| P2 | `vitest.config.ts` excludes `src/**/index.ts` and `src/index.ts` from coverage, so the 115 barrel assertions added in this pass contribute **0%** to the reported coverage figure — a future reader may conclude the barrels are untested. | `vitest.config.ts` (`coverage.exclude`), `src/index.test.ts` and the 18 module `index.test.ts` files | Keep the exclusion but note it in the package README/knowledge.md, or include barrels in coverage now that they are asserted. |
| P3 | Barrel tests import through two different mechanisms: several legacy assertions use the self-name alias `@presource/core` (which resolves to `src/index.ts` via `package.json` `main`/`types`), while the new full-surface assertions import the relative barrel. If the alias ever resolves to `dist`, the identity checks compare build output. | `package.json` `exports.development` condition; mixed imports across `src/**/*.test.ts` | Normalize all package-internal test imports to relative paths in one sweep. |
| P3 | `arrayCreate(Infinity)` still exhausts the array length (`RangeError`), because the clamp added in this pass floors rather than bounds the value. | `src/array/create.ts:71-72`; deliberately not asserted (the throw is slow and memory-heavy) | Add a finite upper bound and a named error, then assert it. |

## Engine-sensitive assertions now in the suite (P3)

Recorded so a future Node/V8 upgrade does not read them as product regressions.
Each is a thrown-message or formatting assumption, not a value contract:

- `src/object/has.test.ts`, `src/object/each.test.ts`, `src/object/update.test.ts`,
  `src/object/alias.test.ts` — V8 messages (`Cannot convert undefined or null to
  object`, `… hasOwnProperty is not a function`, `Cannot add property b, object
  is not extensible`, `Cannot create proxy with a non-object as target or
  handler`).
- `src/to/string.test.ts`, `src/type/switch.test.ts` — `is not a function` and
  `Converting circular structure to JSON` substrings; two function-source
  assertions (`'() => {}'`, `'function() {}'`) depend on the transpiler's output
  formatting.
- `src/data/list.test.ts` — `Cannot convert a Symbol value to a string`.
- `src/object/proxy.test.ts` — one internal-symbol read
  (`Symbol(Symbol.toPrimitive)`, `Symbol(Symbol.toStringTag)`).
- `src/array/wrapper/methods/select.test.ts`, `src/function/queue.test.ts` —
  `toThrow(TypeError)` without a message, because the message embeds
  minified identifiers when read from `dist`.
- `src/script/async.test.ts` — two cases register/restore an
  `unhandledRejection` listener so Vitest does not claim the escaped rejection,
  and several event-order assertions rest on V8 microtask/macrotask ordering.
- `src/data/clone.test.ts`, `src/json/*`, `src/is/*` — `Date`/`BigInt`/locale
  strings avoided deliberately (`new Date(0).toString()` compared against itself).

## `TODO: pending` inventory (21 markers, all pre-existing)

Every marker still in `src/**` after this pass, with where the behavior is
recorded here. The one non-marker row is marked as such and is included only for
cross-reference.

| Marker | File:line | Tracked in |
|---|---|---|
| BUG: `runTask(task)` fire-and-forget, retry errors lost | `src/script/async.ts:136` | [0001](./0001-script-async-never-settles.md) |
| Configs type is `{}` (unused) | `src/script/async.ts:19` | this file (P3) |
| return `memory` exposes mutable internals | `src/function/queue.ts:110` | [0002](./0002-function-queue-one-shot-busy.md) |
| Returns void while `loopWhile` returns `params.result` | `src/loop/until.ts:58` | [0004](./0004-loop-result-contracts.md) |
| `select` — null/undefined in `Possible` type, unhandled | `src/array/wrapper/methods/select.ts:13` | [0005](./0005-array-wrapper-filter-sharing.md) |
| `typeName` `''` handling — a plain comment, not a `TODO` marker, but it is the site that guesses `null` vs `undefined` | `src/type/switch.ts:85-87` | [0006](./0006-typename-empty-sentinel.md) |
| `booleanPartialFalse` recurses through `booleanPartialTrue` | `src/boolean/partial.ts:51` | this file — **caution**: applying the TODO as written flips `booleanPartialFalse({a:{b:true,c:true}})` from the correct `false` to `true`, because the object branch is evaluated by the `!boolValue` test in the caller. The nesting needs "all leaves truthy" reasoning, not a one-word swap. |
| `cache` param in signature, not in implementation | `src/data/clone.ts:39` | [0009](./0009-dataclone-reference-sharing-and-cycles.md) |
| `request` param accepted but unused | `src/data/list.ts:143` | [0010](./0010-object-module-review-list.md), this file (P3) |
| `pending.callback()` called with no args on `.get` | `src/function/chain.ts:106` | this file (P3) |
| Hard-coded excluded properties | `src/function/control.ts:38` | this file (P3) |
| `fn.length` ignores rest parameters | `src/function/curry.ts:29` | this file (P3) |
| No cancel/abort API for `functionDelay` | `src/function/delay.ts:16` | this file (P3) |
| BUG: `throughGetQuery` shared across proxies | `src/function/proxy.ts:35` | this file (P3) |
| Commented-out async state implementation | `src/function/state.ts:75` | this file (P2 — decide: implement or remove; the dead code sits directly above the unreachable branch at `:43`) |
| Missing type predicate `value is true` | `src/is/boolean.ts:25` | this file (P1) |
| Missing type predicate `value is false` | `src/is/boolean.ts:34` | this file (P1) |
| BUG: `jsonUpdate` mutates `primaryObject` | `src/json/update.ts:28` | [0010](./0010-object-module-review-list.md) |
| Number case unimplemented in `objectExtract` | `src/object/extract.ts:63` | this file (P3) |
| Stub: `resolveValue` never resolves, returns `{}` | `src/object/resolve.ts:23` | [0010](./0010-object-module-review-list.md) |
| BUG: `letter` mutated across words | `src/string/capitalize.ts:24` | this file (P1 — one-line fix: `const pos = letter < 0 ? letter + length : letter`, pinned cases in `src/string/capitalize.test.ts`) |
| Return type mismatch in `stringIncludes` | `src/string/includes.ts:55` | this file (P2) |

Markers **removed** by this pass, because the code they describe was fixed:
`src/array/wrapper/methods/count.ts` (unrecognized keyword `TypeError`),
`src/array/wrapper/methods/random.ts` (debug `console.log`), and the
"always false" note in `src/array/wrapper/methods/is.ts`. See
[0012](./0012-applied-fixes-2026-11.md).

## Unrelated notes observed during the pass (P3)

- `string/capitalize.ts:24-25` also means the parameter is *rebased per word*, so
  `('ab cd ef', -2)` is `'Ab Cd Ef'` and `('hello world', -10)` is
  `'ello World'` — both pinned in `src/string/capitalize.test.ts`.
- `string/switch.ts:52-63` — the per-case closures ignore their argument and
  re-dispatch with the **case's own key** (`params.a('x')` runs case `a` with the
  original value), which the `Argument<T>` type at `:21-22` contradicts.
  `src/string/switch.test.ts` pins the observed `seen = ['a','b','b','b']`.
- `string/includes.ts:64` — the argument object is `{ value, ...params }`, so a
  case literally keyed `value` overwrites `args.value` (pinned).
- `class/create.ts:13-17` — a reference default declared in the shape is **not**
  cloned, so all instances share it; positional slots follow `Object.keys` order,
  so integer-like keys reorder ascending (both pinned).
- `array/each.ts:55-63` — the params object handed to every iteration is **one
  shared, mutated record** with five keys (`result` is not in the JSDoc list), so
  an array of collected params must be snapshotted inside the callback. Pinned by
  the exact `Object.keys` assertions in `src/array/each.test.ts`.
- `objectScan`'s `path` is copied per level (`scan.ts:55`) but the copy is handed
  to the callback before the child path is derived from it — see
  [0010](./0010-object-module-review-list.md).
- `packages/presource/core/dist/` is only refreshed by `npm run build`; during
  this pass it briefly lagged the source, which is worth remembering when a
  probe disagrees with a Vitest run (Vitest resolves `@presource/core` →
  `src/index.ts` through the `development` export condition).

## Out of scope for this list

- The nine numbered issues; this file deliberately excludes anything with its own
  proposal section.
- Test-framework choices (fake timers, `vi.spyOn`) and test style; the suite's
  determinism rules are recorded in the test files' own headers.
- Anything in `@presource/nexus` or the consumer packages, except where a core
  change would require auditing them (noted inline in 0006 and 0009).
