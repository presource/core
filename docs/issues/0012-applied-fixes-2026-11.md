# 0012 - Applied fixes (2026-11-04 review pass): six defects fixed rather than pinned

> **Status:** Closed — fixes applied in the working tree, **not yet committed**;
> `dist/` has been rebuilt once (`npx vite build`) but `npm run build` should be
> re-run before publishing so the declaration files match.
> **Severity:** Closed
> **Area:** `src/constants/*`, `src/index.ts`, `src/array/create.ts`,
> `src/array/wrapper/methods/{keys,is,count,random}.ts`
> **Date opened:** 2026-11-04

## Why these six and not the rest

Every other finding in this log is a behavior change that would alter results for
the nine consumer packages, so it was left open with the current behavior pinned
by tests. These six were different in kind: each one either crashed, hung,
printed to stdout, or exported nothing, and in each case the module's **own**
JSDoc/type/`knowledge.md` statement already specified the fixed behavior. The
code was moved to the documented contract rather than the contract rewritten
around the code.

Consumer impact was checked before each change:

- `arrayCreate` — every call site in the workspace passes an integer
  (`distribution/ScriptingSpaceFormatter/src/plugins/differenceCsv/diffLines.ts:41-44`,
  `distribution/comfy-dashboard/src/frontend/features/workflow/components/GenerationsPane.tsx:326-328`)
  or destructures only `{ index }` from the factory payload (~60 sites in
  `distribution/worksheets/**`), so the clamp and the added payload keys are both
  no-ops for them.
- `arrayWrapper` — no production consumers outside this package at all; the only
  external reference is
  `packages/react/material/features/basic-side-bar/BasicSideBar.stories.tsx:6,19`.

## 1. The documented constants did not exist

**Defect.** `knowledge.md:74-75` and `:390-399` document six string constants;
`src/constants/index.ts` was a **0-byte file**, and `src/index.ts` did not
`export * from './constants'`. `import { EMPTY_STRING } from '@presource/core'`
therefore resolved to `undefined` — and two repo scripts do exactly that:
`scripts/clean-temp.ts:19,67` and `scripts/sync-versions.ts:22,94`. Two other
packages had already worked around the gap with local copies
(`packages/rightless/icons/src/components/svg/svg-string.ts:38-40`,
`packages/userfiction/visual/src/icons/svg-icon.ts:156-159`). Probed against the
built bundle: the root namespace had 91 exports and none matched `/STRING/`.

**Fix.** `src/constants/strings.ts` (new) exports `EMPTY_STRING`,
`SPACE_STRING`, `NUMBERS_STRING`, `ALPHABET_STRING`, `NULL_STRING`,
`UNDEFINED_STRING`; `src/constants/index.ts` re-exports it; `src/index.ts:11-13`
adds the missing `export * from './constants'`. Root namespace is now 97 exports.

**Tests:** `src/constants/strings.test.ts` (8 cases, exact values plus
`NULL_STRING === String(null)` / `UNDEFINED_STRING === String(undefined)`),
`src/constants/index.test.ts` (3 cases, exact 6-name key list),
`src/index.test.ts` (asserts all six values at the root — the regression guard),
`src/class/index.test.ts`, `src/promise/index.test.ts`, `src/string/index.test.ts`,
`src/task/index.test.ts` (new; the barrels that had no test file before).

## 2. `arrayCreate` grew the array until the engine threw

**Defect.** `number` mode was `while (value--) result.push(undefined)`. Any
negative number is truthy, so a fractional or negative length never terminated:
`arrayCreate(2.7)` and `arrayCreate(-3)` pushed until
`RangeError: Invalid array length` (verified at runtime, not inferred).

**Fix.** `src/array/create.ts:71-72` clamps with
`const length = value > 0 ? Math.floor(value) : 0` and counts up, so an invalid
length produces a shorter or empty array instead of throwing — matching this
function's behavior for every other input type. `Infinity` is still unbounded
(recorded in
[0011](./0011-api-surface-and-doc-drift.md)).

**Also fixed:** the factory branch passed only `{ index }` although the declared
`Arguments` type (`:13-20`) documents `{ index, value, result }`; `:57` now passes
all three (`value` = the previous element, `result` = the live accumulated array).

**Tests:** `src/array/create.test.ts` grew 1 → 11 cases, including the full
per-call payload assertion (`Object.keys` exactly
`['index','value','result']`, `result` snapshots `[] → [0] → [0,10] → [0,10,20]`),
falsy-but-defined factory values (`0`, `''`, `false`, `null` all collected), and
non-number/non-function inputs.

## 3. `arrayWrapper` keys and `get()` were lexicographically sorted

**Defect.** `keys.ts` ended with `result.sort()` — `Array#sort` with no comparator
compares strings — so a 12-element wrapper produced
`[0, 1, 10, 11, 2, 3, …]`, and `get()` returned the elements in that order
(probed: `['a','b','k','l','c',…]`). `remove()` was already correct because it
compensates for index shifts, but any consumer reading `keys()`/`get()` on a
10+ element array got shuffled data.

**Fix.** `src/array/wrapper/methods/keys.ts:102-107` sorts with
`(a, b) => a - b`, with a comment naming the failure mode.

**Tests:** `keys.test.ts` 4 → 9 cases (`keys()` on 12 elements → exactly
`[0..11]`, plus an explicit `not.toStrictEqual([0,1,10,11,2,…])` negative case);
`get.test.ts` 4 → 7 (true index order, duplicate-criteria collapse, fresh-array
guarantee); `remove.test.ts` 5 → 9 (`[10,0]` vs `[0,10]` and `[2,10]` vs `[10,2]`
regression pairs).

## 4. `is('invalid')` could never be true

**Defect.** The `invalid` case was `({ valid }) => !valid` — it negated the
**function reference** that `stringSwitch` injects for the sibling case instead of
calling it, so the expression was `!Function` → always `false`, for every input.
`$array([null, undefined]).is('invalid')` was `false`.

**Fix.** `src/array/wrapper/methods/is.ts:46` calls the sibling: `!valid()`,
matching the `filled` case right beside it (`!empty()` at `:48`), which was
already written correctly. The JSDoc at `:26-32` was updated from "always false"
to the real rule.

**Tests:** `is.test.ts` 5 → 6 cases; the weak
`expect(typeof …is('invalid')).toBe('boolean')` assertion (which passed even while
broken) was replaced with four exact ones — `[1,null] → true`, `[1,2] → false`,
`[] → false`, `[0,'',false] → false`.

## 5. `count('<unrecognized keyword>')` threw a `TypeError`

**Defect.** `count.ts` looked the keyword up in an options map and called the
result unconditionally, so any string outside the eight supported names threw
`TypeError: checkFunction is not a function` — while the function's own JSDoc
(`:26`) promised "when `request` is omitted or not a recognized type name, counts
all elements". A source TODO marked it as a known bug.

**Fix.** `src/array/wrapper/methods/count.ts:56-66` falls back to a
count-everything predicate for an unknown keyword, and `'object'` was added to the
`RequestString` union (`:13`) because the map already supported it.

**Tests:** `count.test.ts` 2 → 6 cases: all eight keywords against one mixed
fixture with exact counts, an unknown keyword returning the full count with a
`.not.toThrow()` guard, non-string requests, and count-under-`select`.

## 6. `random()` logged the whole array on every call

**Defect.** `random.ts` carried a leftover debug statement
`console.log('what is instance:', element)` — one line of stdout per draw, from a
library function, marked by its own "remove debug console.log" TODO. Confirmed by
capturing stdout during a probe (`['what is instance: 1,2,3', 'what is instance: ']`).

**Fix.** `src/array/wrapper/methods/random.ts` — statement deleted; the JSDoc at
`:14-23` now documents the empty-array contract (`undefined`, because
`element[0]` is absent) instead of leaving it implicit.

**Tests:** `random.test.ts` 1 → 7 cases: `Math.random` stubbed to 0 / 0.999 / 0.5 /
the 0.25-vs-0.2499999 boundary with the exact element each returns, exactly one
`Math.random` call per draw, empty array → `undefined`, and
`console.log/warn/error/info/debug` all asserted at **0 calls**.

## Verification for this pass

| Command (from `packages/presource/core`) | Result |
|---|---|
| `npx vitest run --coverage` | **108 files / 1338 tests passed** — baseline before the pass was 101 files / 428 tests |
| `npx tsc --noEmit` | 0 diagnostics |
| Coverage | Statements 100% (1176/1176), Branches 99.27% (413/416), Functions 100% (372/372), Lines 100% (1076/1076) |
| Remaining uncovered branches | 3, all proven dead code — see [0011](./0011-api-surface-and-doc-drift.md) |

No test was deleted to obtain this result; the only removed assertions are the
three weak ones named above (the `typeof` check, the `expect(true)` placeholders
in `src/script/async.test.ts`, and the range/`toContain` comparisons in
`src/function/*`), each replaced by an exact expectation.

## Follow-ups on these six

1. Commit the changes and re-run `npm run build` so `dist/presource-core.mjs`
   ships the fixes — the `import` export condition in `package.json` points at
   `dist/`, so a consumer resolving that condition still sees the pre-fix
   behavior until the build is published.
2. Decide whether the two other packages with local `EMPTY_STRING` copies
   (`packages/rightless/icons`, `packages/userfiction/visual`) should drop the
   workaround now that the export exists.
3. `arrayCreate(Infinity)` remains unbounded
   ([0011](./0011-api-surface-and-doc-drift.md)).
4. The wrapper fixes here do not close the facade's design problems
   ([0005](./0005-array-wrapper-filter-sharing.md)).
