# 0001 - `scriptAsync().process()` never settles when a task rejects or a stale retry short-circuits

> **Status:** Open
> **Severity:** Blocking
> **Area:** `src/script/async.ts` (task runner, drain signalling)
> **Date opened:** 2026-11-04

## Context

`scriptAsync` is the package's concurrent task runner: `append` callbacks with
`handler.append(cb)`, start the batch with `await handler.process(input)`, and a
callback that returns exactly `false` is retried until it succeeds or the run is
killed by `input.shouldContinue()`. Nine workspace packages consume
`@presource/core`; a host that runs retriable work (a queue drain, a poll-until-
ready sequence, an upload batch) reaches for this helper and treats
`await process()` as a completion barrier — the same contract
`taskCompletion().completion()` and `functionQueue().done()` provide.

Two paths break that contract. Both were found by reading the drain bookkeeping
and then pinned by tests that had to be written against an observation other
than "the promise resolved".

## Gap

A consumer cannot rely on `process()` settling, and cannot see why when it does
not:

- **a rejecting task hangs the run.** `await task.callback()` is not guarded, so
  a task that throws/rejects propagates out of `runTask` before `running--` and
  before `checkDrained()` ever happen. `runTask`'s own returned promise rejects
  into nobody (`pending.forEach((task) => runTask(task))` at `:154` discards it),
  so the caller gets no error — only an `unhandledRejection` on the process —
  and `await drained` at `:158` waits forever.
- **a retried task double-counts as pending.** The retry at `:135-138` is
  fire-and-forget, so a second `process()` over the same task list can re-enter
  `runTask` for a task that has already completed. The guard at `:105` returns
  early **without** calling `checkDrained()`, so if that stale re-entry was the
  only outstanding work, the first run's promise is also never settled.
- **errors from the retry path are lost entirely** — the existing TODO at `:136`
  says they are "silently lost". They are in fact *unhandled* as well as lost,
  which is worse: they surface as process-level warnings rather than as a
  rejection of the promise the caller is awaiting.
- there is no way to be told a task failed. `process()` resolves `void` on the
  success paths, so a host has no failure signal even when the run does settle.

The practical consequence for a consumer is that wrapping every task body in its
own `try/catch` is mandatory, and the runner still cannot be re-entered safely.

## Why it is the way it is

The drain signal is deliberately a *counting* mechanism, not a promise-chain
mechanism: `running` (`:93`) is decremented around a single `await`
(`:107`/`:109`) and `checkDrained` (`:96-101`) is the only settle path other than
the explicit `notifyDrained()` calls at `:127`, `:150` and `:158`. That design
is what lets `shouldContinue()` abort mid-run — `killed` short-circuits every
branch — and the `killed` early returns at `:97`, `:105` and `:111` are correct
*because* the kill path settles eagerly at `:127`.

The rejection hole is not a design decision: it is an unguarded `await`, and the
file already flags the sibling problem itself (`:136`).

## Evidence

- `src/script/async.ts:96-101` — `checkDrained` returns immediately when
  `killed`, else settles only if `running === 0` **and** no task is still
  pending.
- `src/script/async.ts:105` — `if (killed || !task.flags.pending) return;`
  with no `checkDrained()` on the `!task.flags.pending` side.
- `src/script/async.ts:107-109` — `running++; const success = await
  task.callback(); running--;` — no `try/catch`, so a rejection skips
  `running--` and everything after it.
- `src/script/async.ts:130-139` — retry branch: `task.counter.retries++`, a
  `setTimeout(0)` yield, then `runTask(task)` not awaited, then `return` —
  `checkDrained()` at `:142` is never reached for a retried task on that pass.
- `src/script/async.ts:136` — pre-existing `TODO: pending - BUG: runTask(task)
  is fire-and-forget. Errors from retry are silently lost. Should await or
  catch`.
- `src/script/async.ts:146-158` — `kickoff()` discards each `runTask` promise;
  `await drained` is the only thing keeping `process()` alive.
- Consumer contract, for contrast: `src/task/completion.ts:80-86` releases its
  slot on **both** fulfilment and rejection (`.then(release, release)`), and
  `src/function/queue.ts:89-95` awaits promise results before continuing. This
  module is the odd one out.
- Pinning tests: `src/script/async.test.ts` (rejecting first-pass task,
  rejecting retry task, and the two stale-retry cases that reach `:97` and
  `:105`).

## Proposal

Smallest change that closes the gap without touching the kill semantics:

1. Wrap the task body: `let success; try { success = await task.callback(); }
   catch { success = false; }` at `:108`, so a rejection is the same as an
   explicit retry signal, and after `retries` exceed a bound treat it as a
   permanent failure (`task.flags.pending = false`) rather than looping forever.
2. Make the retry awaited (`await runTask(task)` inside a `.catch(() => {})`, or
   restructure the retry as a loop inside one `runTask` frame) so a retry error
   reaches the awaiting frame instead of the process.
3. Call `checkDrained()` on **every** early return (`:105` included), keeping the
   `killed` guard at `:97` as the reason those returns are safe.
4. Optional, separate decision: have `process()` resolve with a per-task result
   summary so a failure is at least observable.

Alternatives considered and rejected:

- **`Promise.allSettled` over the kickoff list instead of the counter.** Cleaner,
  but it loses mid-run abort: `shouldContinue()` currently stops the batch
  between tasks, and `allSettled` would let every already-started task run to
  completion first.
- **Documenting "tasks must not reject" and leaving the code alone.** Cheaper,
  but `taskCompletion` and `functionQueue` in the same package already tolerate
  rejections, so a doc rule here would just move the surprise.

## Acceptance criteria

- A task whose callback rejects does not hang `process()`; the run settles, and
  the failure is either retried (bounded) or reported.
- Two `process()` calls over one handler both settle; neither leaves the other
  pending.
- The `killed` paths still settle exactly once (no double-resolve) — currently
  pinned by the `settleCount === 1` assertions in `src/script/async.test.ts`.
- `input.shouldContinue()` retains its "stop the whole batch now" behavior.

## Tests to add

`src/script/async.test.ts` — cases to update once the fix lands (they currently
pin the broken behavior on purpose):

- the two task-rejection cases: replace "promise stays pending +
  `unhandledRejection` observed" with "resolves, and the task is retried N times
  then marked failed".
- the stale-retry case that currently asserts "run 1 does not settle": change to
  "run 1 settles".
- new: a task that rejects exactly once then succeeds, asserting the retry
  counter and a single settle.
- new: bounded retry — a task that always rejects, asserting the retry cap and
  the settle (no infinite loop).
- keep the `unhandledRejection` listener juggling only for as long as any path
  can still escape.

## Out of scope

- Adding a cancellation token, priorities, or per-task timeouts.
- Changing the `append`/`process` shape into a single-call API.
- Redefining what `shouldContinue()` may do asynchronously.
- `scriptChain`'s separate relay problem ([0003](./0003-script-chain-returns-accessor-not-relay.md)).
