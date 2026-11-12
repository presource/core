# 0004 - Loop result contracts: `loopWhile` can never return a value, `loopUntil` returns `void`, `params.result` is unobservable

> **Status:** Open
> **Severity:** Significant
> **Area:** `src/loop/while.ts`, `src/loop/until.ts`, `src/loop/for.ts`
> **Date opened:** 2026-11-04

## Context

The three loop helpers share one idiom: the callback's return value is the loop's
control signal. Returning exactly `undefined` continues; returning anything else
(including `0`, `''`, `false`, `null`) breaks the loop and is meant to be the
loop's result. That is what the JSDoc says for each of them:

- `while.ts:54` — "@returns The final value of `params.result` after the loop
  ends";
- `for.ts:88` — "@returns The final value of `record.result` after the loop
  ends";
- `until.ts:50-52` — "Behaves like a `do … while (!condition)` construct: the
  loop body runs at least once".

Two of the three do not do what the comment says, and in all three the
`result` field handed to the callback is write-only.

## Gap

**`loopWhile` cannot return a break value.** `while.ts:64-71`:

```ts
while (condition(params)) {
  const result = callback(params);
  if (result !== undefined) break;   // :67 — leaves without storing
  params.count++;
  params.result = result;            // :70 — only reached on non-break paths
}
return params.result;                // :72
```

A breaking callback returns a non-`undefined` value that is never stored, so
`params.result` is whatever the previous iteration left there — and a continuing
iteration always stores `undefined`. Therefore `loopWhile` returns `undefined`
for **every** input: both the break path and the condition-exhausted path. Any
consumer writing `const found = loopWhile(…)` gets `undefined` and has to hoist a
variable outside the loop, which is the pattern these helpers exist to avoid.

**`loopUntil` returns `void`.** `until.ts:67-74` has the same break-before-store
ordering and no `return` statement at all. `until.ts:58` already carries
`TODO: pending - Returns void while loopWhile returns params.result. Inconsistent
API`, but the inconsistency is stated the wrong way round: `loopWhile`'s
`params.result` is always `undefined`, so the two functions agree in outcome and
differ only in type.

**`loopUntil`'s JSDoc contradicts the implementation.** The condition is
evaluated in the `while` header (`until.ts:67`), so
`loopUntil(() => true, cb)` runs the callback **zero** times — it is
`while (!condition)`, not `do { … } while (!condition)`. The comment at `:50-52`
promises "at least once", and `:66` ("Note: `!condition` makes this the logical
inverse of `loopWhile`") describes the correct behavior three lines below the
wrong one.

**`params.result` is dead weight in all three loops.** A callback only ever sees
a defined `result` if a previous iteration stored one, and a previous iteration
stores a value only when it broke — in which case there is no next iteration.
`for.ts:93`/`:132` assign `record.result = callback(record)` before the break, so
`loopFor`/`loopForAsync` do return the break value correctly, but the value is
still never visible *to a callback* on the following pass.

## Why it is the way it is

`loopFor` is the reference implementation and it gets the ordering right
(`for.ts:92-98` and `:129-137`): assign, then test, then break. `loopWhile` and
`loopUntil` appear to have been written from the same shape with the assignment
moved after the break test, which is a subtle but total change of contract.

The `result` field is part of the shared `Argument` record
(`while.ts:20-25`, `until.ts:19-27`, `for.ts:72`) that also carries `condition`
and `callback` so a condition can re-invoke the body — the recursion pattern the
`for` tests exercise (`args.callback(args)`). Keeping `result` in the record for
that purpose is reasonable; advertising it as an observation channel is not.

`loopFor`'s break-before-`index++`/`count++` ordering (`for.ts:94-96`) is also
intentional-looking: the breaking iteration's `index`/`count` identify where the
search stopped, which is what a consumer wants when the callback closes over the
record.

## Evidence

- `src/loop/while.ts:64-72` — break at `:67` before `params.result = result` at
  `:70`; `return params.result` at `:72`.
- `src/loop/while.ts:54` — JSDoc promising the final `params.result`.
- `src/loop/until.ts:67-74` — same ordering, no `return` (function ends at
  `:75` with no value).
- `src/loop/until.ts:58` — pre-existing TODO about the inconsistent return.
- `src/loop/until.ts:50-52` vs `:66-67` — "runs at least once" vs
  `while (!condition(params))`.
- `src/loop/for.ts:90-99` — sync loop assigns `:93` then breaks `:94` then
  increments `:95-96`, returns `record.result` `:98`. Correct.
- `src/loop/for.ts:129-137` — async loop, same correct ordering
  (`:132` assign, `:133` break, `:134` count).
- `src/loop/for.ts:63-73` — the record's `result` initialised to `undefined` and
  only ever reassigned from a callback return.
- Short-circuit semantics shared with `arrayEach`/`objectEach`: the test
  matrices for falsy-but-defined break values (`0`, `''`, `false`, `null`) live
  in `src/loop/for.test.ts` (`test.each` block), `until.test.ts`, `while.test.ts`.
- Pinning tests: `src/loop/while.test.ts` (first-pass break → `undefined`),
  `src/loop/until.test.ts` (zero runs when the condition starts true; break value
  not returned), `src/loop/for.test.ts` (break value returned;
  `index`/`count` frozen at the breaking iteration).

## Proposal

Smallest change, per file:

1. `while.ts:67-70` — assign `params.result = result` **before** the break test,
   exactly as `for.ts:93-94` already does. `loopWhile` then satisfies its own
   `@returns`.
2. `until.ts:67-74` — same reorder, plus `return params.result;` to match
   `loopWhile`, closing the TODO at `:58`.
3. `until.ts:50-52` — drop the "runs at least once" sentence (or convert the loop
   to a real do-while if at-least-once is the intent — a separate decision, and
   the one behavior change here that could surprise a consumer).
4. JSDoc in all three: state that `result` is a write-only field within a run and
   that a callback should use its own closure to carry values forward.

Alternatives considered and rejected:

- **Leave `loopWhile`/`loopUntil` returning `undefined` always and fix the docs.**
  Cheapest, but `loopFor` already returns the break value, so the module would
  ship two contradictory return contracts for the same control idiom. The
  one-line reorder is smaller than the doc churn.
- **Make `result` meaningful across iterations** (store the non-breaking return
  too). Impossible: a non-breaking return is by definition `undefined`.

## Acceptance criteria

- `loopWhile(() => true, () => 'halt')` returns `'halt'`.
- `loopUntil` returns the same shape as `loopWhile` (or the TODO at `:58` is
  resolved in the other direction and both are documented as side-effect-only).
- `loopUntil(() => true, cb)` runs `cb` zero times, and the JSDoc says so.
- `loopFor`/`loopForAsync` behavior is unchanged (already correct).
- All three agree on the falsy-but-defined break rule (`0`/`''`/`false`/`null`
  break, `undefined` continues).

## Tests to add

`src/loop/while.test.ts` and `src/loop/until.test.ts`:

- change the two "break value is not returned" expectations to exact return
  values (`'halted'`, `0`, `''`, `false`, `null` via a `test.each` matrix);
- new: a multi-iteration fixture asserting the returned value comes from the
  breaking iteration and that `count`/`index` reflect it;
- keep the zero-run and condition-receives-params cases (they pin behavior that
  is not changing).

`src/loop/for.test.ts` — unchanged; it is the reference contract.

## Out of scope

- Adding `break`/`continue` sentinel objects instead of the `undefined` rule.
- Unifying the three helpers into one implementation with a mode flag.
- Changing `loopFor`'s `index`/`count` freeze on break.
- The `arrayEach`/`objectEach`/`loopFor` params objects being a single shared,
  mutated record (tracked in
  [0011](./0011-api-surface-and-doc-drift.md)).
