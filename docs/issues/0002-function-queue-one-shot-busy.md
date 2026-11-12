# 0002 - `functionQueue` is one-shot: `busy` is never cleared on the drain, kill, or falsy-item paths

> **Status:** Open
> **Severity:** Blocking
> **Area:** `src/function/queue.ts` (queue processor, lifecycle listeners)
> **Date opened:** 2026-11-04

## Context

`functionQueue` is the package's sequential executor and the engine behind
`scriptChain`. Its documented surface is a callable accessor: call it with a
callback to enqueue, call it with no arguments to read the internal `memory`,
`.kill()` to clear, `.done()` to finish and fire `complete`. The JSDoc at
`:44-47` describes those as operations on a reusable queue.

The processor is guarded by a `busy` flag so that a burst of rapid enqueues is
batched into one pass. That flag is cleared in exactly one place —
`continueQueue` (`:56-60`), which runs after an item's result is delivered. Every
other way out of the processor leaves `busy === true`, and the guard at `:65`
then rejects all future work.

## Gap

A consumer can use a queue exactly once:

- **after a batch drains, later enqueues are never executed.** The empty-queue
  branch (`:98-104`) defers `completeScriptObject(memory)` and returns; nothing
  resets `busy`. A subsequent `queue(cb)` enqueues (`:113`) and defers
  `processQueue` (`:116`), which returns at `:65`. The item sits in `memory.queue`
  forever — visible to a caller who inspects `memory`, invisible to a caller who
  expects execution.
- **`.kill()` does not make the queue reusable either.** `destroyScriptObject`
  (`:143-146`) replaces `memory.queue` with `[]` but never touches `busy`, which
  lives in the enclosing closure. A killed queue stays permanently busy.
- **`.kill()` is not silent.** The doc at `:142` says killing clears the queue
  "without firing the `complete` listener". The listener is indeed not fired by
  `destroyScriptObject`, but an already-deferred `processQueue` from `:116` still
  runs afterwards, finds the queue empty, and fires `completeScriptObject`
  (`:102`). So `complete` fires anyway.
- **a falsy queued item throws before its own guard.** `const { delay } =
  queue[0]` at `:74` runs before the `if (callback)` guard at `:85`, so a
  `null`/`undefined` entry throws `TypeError` at destructuring instead of being
  skipped. A falsy-but-destructuring item (e.g. `0`) is skipped at `:85` but,
  because `continueQueue` is not called, also leaves `busy === true`.
- the mutable internal `memory` is handed to callers (`:110-111`, existing
  TODO), which is how the drain and falsy-item tests are forced to drive the
  queue at all.

## Why it is the way it is

The deferral is deliberate and is the point of the design: items are enqueued
synchronously, and `functionDelay(processQueue)` (`:116`) lets a burst batch
together before the first callback runs — the comment at `:77` states exactly
that ("This allowed queueing lots of function before the first one get
executed"). `busy` is the re-entrancy lock for that deferral.

What is *not* deliberate-looking is the choice of `continueQueue` as the only
unlock site. The empty-queue branch needs no unlock because the author appears to
have assumed the queue is finished there — which is true only if the queue is
never used again. Both `kill` and `done` (`:126-129`) are also written as
one-way teardowns. So the current shape is consistent with a single-use queue and
inconsistent with a reusable one; the JSDoc and `scriptChain` both assume reuse.

## Evidence

- `src/function/queue.ts:53` — `let busy = false;` (closure state, not part of
  `memory`).
- `src/function/queue.ts:56-60` — `continueQueue` is the only writer of
  `busy = false`, then it re-enters `processQueue`.
- `src/function/queue.ts:63-67` — `processQueue` guard `if (busy) return;` then
  `busy = true`.
- `src/function/queue.ts:74` — `const { delay } = queue[0];` executes before the
  item is shifted or validated.
- `src/function/queue.ts:85-96` — `if (callback)` skips falsy items without ever
  calling `continueQueue`.
- `src/function/queue.ts:98-104` — empty-queue branch: defers
  `completeScriptObject(memory)`, no `busy` reset.
- `src/function/queue.ts:110-111` — `if (script === undefined) return memory;`
  plus the pre-existing `TODO: pending - return memory exposes mutable internal
  state to callers`.
- `src/function/queue.ts:126-129` and `:136-146` — `kill`/`done` operate only on
  `memory`; neither resets `busy`; `completeScriptObject` fires `on.complete`.
- Reuse dependency: `src/script/chain.ts:81-92` nulls the relay in the
  `complete` listener specifically so the queue is expected to run again —
  see [0003](./0003-script-chain-returns-accessor-not-relay.md).
- Pinning tests: `src/function/queue.test.ts` — `leaves an empty queue…`,
  the `queue.ts:85` falsy-item case, and `delays an individual item` are coupled
  to the current stall; the file's header comment records that coupling so a fix
  is not mistaken for a broken test.

## Proposal

Smallest change that keeps the batching behavior:

1. Reset `busy = false` when the processor finishes a pass without an item to
   process — i.e. in the empty-queue branch at `:98-104` — and again in
   `destroyScriptObject` by moving `busy` into `memory` (e.g.
   `memory.busy`) so the teardowns at `:127-128` can reach it.
2. Read the item first, then its delay: move `const { delay } = queue[0]` below
   the shift+guard, and call `continueQueue` (or re-enter `processQueue`) when a
   falsy item is skipped.
3. Add a `killed` flag set by `destroyScriptObject`, checked at the top of
   `processQueue`, so `.kill()` really is silent; clear it on the next enqueue.
4. Keep `memory` exposure as-is (issue-level TODO at `:110`), since the tests
   and `scriptChain` both rely on it.

Alternatives considered and rejected:

- **Drop `busy` and rely on the `functionDelay` deferral alone.** Simpler, but it
  reintroduces concurrent processors: two deferred `processQueue` calls would
  both shift items and both call `continueQueue`, firing `execute` twice per
  item.
- **Make `kill()`/`done()` construct a brand-new queue internally.** Preserves
  the accessor identity but silently discards registered `on` listeners, which
  is a bigger behavior change than a flag reset.

## Acceptance criteria

- Enqueue → drain → enqueue again: the second batch executes and `complete`
  fires exactly once per drain.
- `.kill()` prevents any further `complete` and leaves the queue usable.
- A `null`/`undefined` entry does not throw and does not stall the queue.
- Existing guarantees still hold: FIFO order with `splice(pointer, …)`
  insertion (`:112-114`), awaited promise items (`:89-91`), per-item `delay`/`id`
  setters (`:118-123`).

## Tests to add

`src/function/queue.test.ts`:

- replace the three stall-coupled expectations with "the follow-up batch runs";
- new: `queue()` → drain → `queue()` again, asserting both callbacks ran and
  `execute` fired exactly twice, `complete` exactly twice;
- new: `.kill()` then enqueue, asserting the item runs and the earlier
  `complete` did not fire;
- new: `memory.queue.unshift(null)` asserting no throw and the remaining items
  processed;
- keep the ordering, nesting, promise-awaiting and `done()` cases unchanged.

## Out of scope

- Replacing `functionDelay`-based deferral with microtask scheduling.
- Adding pause/resume, priorities, or an error channel to the queue.
- Removing the `memory` escape hatch (tracked by the TODO at `:110`).
- `scriptChain`'s relay identity ([0003](./0003-script-chain-returns-accessor-not-relay.md)),
  which is the other half of "why reuse matters".
