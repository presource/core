# 0003 - `scriptChain` returns the plain accessor, not the awaitable relay it documents

> **Status:** Open
> **Severity:** Significant
> **Area:** `src/script/chain.ts` (sequential callback relay)
> **Date opened:** 2026-11-04

## Context

`scriptChain({ a, b })` is meant to be a "relay": each key of the input object
becomes a method, invoking a method enqueues that callback into a
`functionQueue`, and the object itself is awaitable so a host can wait for the
whole chain to drain. The file says so three times:

- `:5-8` — "…The relay itself is awaitable and resolves when the run finishes";
- `:25` — the returned type is documented as "The relay object returned by
  `scriptChain`";
- `:46` and `:58` — "@returns A relay object that queues callbacks sequentially
  and **resolves when done**" / "A relay (promise with callback methods)".

The value actually returned is not that object.

## Gap

A consumer that writes the documented usage gets a silent no-op barrier:

```ts
const chain = scriptChain({ step: ({ script }) => { /* async work */ script.next(); } });
await chain;            // resolves immediately — `chain` is a plain function
chain.step();           // this is the call that actually enqueues
await chain.step();     // this one does return the real relay
```

- `scriptChain` returns `script` (`:99-100`), a plain function that
  `objectUpdate` gave the callback methods to. `await script` therefore resolves
  to the function itself on the next microtask, with the queue never even
  created — `generateInstance()` runs only inside a method invocation (`:70`).
- The real relay is created lazily (`:82-96`) as a `promiseCreate` promise
  decorated with the same methods (`:87`), and it is returned *only* from a
  method call (`:77`). So the only awaitable handle is the return value of
  `chain.someStep()`.
- That handle is also transient: the `complete` listener nulls `relay` and
  `queue` (`:92-93`) so the next invocation builds a fresh pair. Two
  interleaved chains therefore await **different** promises, and an await of the
  first relay resolves as soon as the *first* run drains.
- Calling the returned value directly — `script()` — returns `null` before the
  first use (`:61-63`), which is a third distinct behavior for the same object
  and is now pinned by a test.

The net effect: `await scriptChain(...)` looks like a drain barrier and is not
one, which is exactly the failure mode a sequential script runner should not
have. It is also entangled with 0002: because a drained `functionQueue` never
clears `busy`, the "regenerate on the next call" design at `:92-93` cannot
actually run a second chain.

## Why it is the way it is

Laziness is intentional and stated: `:10` — "The relay instance is created
lazily on the first invocation". The reason is visible in `:89-96`: the relay
promise can only be resolved by the queue's `complete` listener, so the queue and
the promise must be created together, and creating them eagerly would fire
`complete` on an empty queue. Returning a function also keeps the "methods are
reachable before anything runs" property, which is why `:99` copies the callbacks
onto `script`.

What is missing is the last step of the documented design: the accessor's own
thenable behavior. A `then` forwarding to `generateInstance()` + the current
relay would satisfy the header text without changing the lazy creation rule.

## Evidence

- `src/script/chain.ts:61-63` — `const script = () => null;`.
- `src/script/chain.ts:64-65` — `relay` and `queue` start `null`.
- `src/script/chain.ts:68-79` — wrapped callbacks: `generateInstance()` then
  `queue(async () => …)` then `return relay` (`:77`).
- `src/script/chain.ts:82-97` — lazy creation: `relay = promiseCreate(promiseControl)`
  (`:86`), `objectUpdate(relay, callbacks)` (`:87`), and the queue whose
  `complete` listener resolves the relay and nulls both (`:89-96`).
- `src/script/chain.ts:99-100` — `objectUpdate(script, callbacks); return script;`
  — the returned value is the accessor, not `relay`.
- `src/script/chain.ts:5-8,25,46,58` — the three places that document the return
  value as an awaitable relay.
- Queue coupling: `src/function/queue.ts:98-104` (drain leaves `busy` set) —
  see [0002](./0002-function-queue-one-shot-busy.md).
- Pinning tests: `src/script/chain.test.ts` — "calling the relay directly before
  first use returns `null`", and the case asserting `await relay` resolves to the
  accessor itself (`expect(await relay).toBe(relay)`), which is the written-down
  form of this gap.

## Proposal

Smallest change that makes the code match its own documentation:

1. Keep the lazy creation and the returned function, and make the returned
   function thenable: give `script` a `then(onFulfilled, onRejected)` that calls
   `generateInstance()` and forwards to the *current* relay. That makes
   `await scriptChain(...)` and `await chain.step()` behave identically, with no
   change to enqueue semantics or to the `null` returned by `script()` (a
   `then` property does not affect direct calls).
2. Track the relay in a stable holder so awaiting an already-drained chain
   resolves instead of hanging: create the relay on demand but resolve
   immediately when the queue is empty and nothing was ever enqueued.
3. Alternatively — if the lazy-accessor shape is considered the real contract —
   fix `:5-8`, `:25`, `:46`, `:58` to say the relay is returned **from a method
   call** and that the top-level value is only a dispatcher. This is the
   documentation-only close for this issue; it does not fix the misleading
   `await`.

Alternatives considered and rejected:

- **Return the eager relay (`promiseCreate`) and put the methods on it.** Matches
  the docs most literally, but the empty-queue `complete` fires on the deferred
  processor (see 0002), so an eagerly created relay resolves before any step has
  run. It also breaks the "call the accessor directly returns `null`" behavior
  the tests pin.
- **Return a class instance with explicit `run()`/`step()` methods.** Cleanest
  long-term, but it is a public API break for every consumer of `scriptChain`.

## Acceptance criteria

- `await scriptChain(list)` does not resolve before the enqueued callbacks have
  run (or the JSDoc at `:46`/`:58` no longer promises that).
- `chain.step()` still returns an awaitable that resolves when that run drains.
- Interleaved runs are either documented or fixed: an await of a relay captured
  from run N must not resolve on behalf of run N+1.
- The `script()` → `null` behavior is preserved or explicitly removed from the
  tests with a note.

## Tests to add

`src/script/chain.test.ts`:

- replace `expect(await relay).toBe(relay)` with an assertion that awaiting the
  top-level value waits for the enqueued callbacks (the spy on the step callback
  must show it ran **before** the await resolved);
- new: two sequential chains from one `scriptChain` result, asserting both
  callbacks ran and each await resolved after its own run;
- new: `await chain.step()` ordering — the second enqueued step must run after
  the first, which is the whole point of the relay;
- keep the `{ script, args }` payload assertions (they are the useful part of the
  current file).

Blocked on 0002 for the "second chain" case: today a drained queue never accepts
new work.

## Out of scope

- Replacing `functionQueue` as the engine.
- Adding an error channel to the relay (today a throwing step is swallowed by the
  queue's promise handling).
- Making the relay cancellable.
