# Issue log — `@presource/core`

Findings against `packages/presource/core`, from the full review pass of
2026-11-04: every runtime module in `src/` was read, its actual behavior was
probed at runtime (plain `node` against `dist/presource-core.mjs`), and the
test suite was rewritten around the probed values.

Each file is one issue. Unlike the sibling log at
`packages/underload/harness/docs/issues/` (which records capability gaps),
**most entries here are correctness findings**: the implementation contradicts
its own JSDoc, its own type signature, or `knowledge.md`. Where the behavior
looks deliberate, **Why it is the way it is** says so and the proposal works
inside the rule.

## Verification baseline

Recorded on 2026-11-04 from `packages/presource/core`:

| Command | Result |
|---|---|
| `npx vitest run --coverage` | 108 files / 1338 tests, all passing (was 101 files / 428 tests before this pass) |
| `npx tsc --noEmit` | 0 diagnostics |
| Coverage | Statements 100% (1176/1176), Branches 99.27% (413/416), Functions 100% (372/372), Lines 100% (1076/1076) |

The three uncovered branches are proven dead code and are recorded in
[0011](./0011-api-surface-and-doc-drift.md); every other branch of every
runtime module is now exercised.

## Index

| Issue | Area | Severity | One line |
|---|---|---|---|
| [0001](./0001-script-async-never-settles.md) | `script/async` | Blocking | `scriptAsync().process()` never settles when a task rejects or when a stale retry short-circuits, and the rejection surfaces only as `unhandledRejection`. |
| [0002](./0002-function-queue-one-shot-busy.md) | `function/queue` | Blocking | `busy` is never cleared on the drain/kill paths, so a `functionQueue` instance processes exactly one batch; a `null` entry throws before its guard, and `kill()` is not silent. |
| [0003](./0003-script-chain-returns-accessor-not-relay.md) | `script/chain` | Significant | `scriptChain` returns the plain accessor, not the awaitable relay its own header documents, so `await` resolves without draining the queue. |
| [0004](./0004-loop-result-contracts.md) | `loop/*` | Significant | `loopWhile` breaks before storing its result so it can never return a defined value; `loopUntil` returns `void` and its "runs at least once" doc is wrong; `params.result` is unobservable in all three loops. |
| [0005](./0005-array-wrapper-filter-sharing.md) | `array/wrapper` | Significant | `select` mutates the shared `config.filter` array (silently narrowing its parent), accepts request types it cannot evaluate, and `random`/`retain`/`each` disagree with the other methods about the active filter. |
| [0006](./0006-typename-empty-sentinel.md) | `type`, `is`, `to`, `object` | Significant | `typeName` returns `''` for `null`, `undefined`, null-prototype objects and anonymous-class instances alike, so `typeSwitch` routes the latter two into the `null` case; `knowledge.md` documents different values. |
| [0007](./0007-typeswitch-delegation-gaps.md) | `type/switch`, `type/switchAsync` | Minor | Nested delegation helpers exist only for declared case keys (undeclared → `TypeError`, not `default`), and the nested spread overwrites `args.value`. |
| [0008](./0008-isempty-semantics-and-null-safety.md) | `is/empty`, `is/function` | Significant | `isEmpty` falls through to `!!input`, so `true`/Date/Map/Set/function/class/Promise report "empty" while `null`/`0`/`false` report "non-empty"; `isEmptyArray`/`isEmptyObject` throw on `null`; generators are not functions. |
| [0009](./0009-dataclone-reference-sharing-and-cycles.md) | `data/clone` | Significant | `dataClone` returns Date/Map/Set/RegExp/class/boxed/function values by reference and overflows the stack on a cyclic object, contradicting `knowledge.md`'s "no shared references". |
| [0010](./0010-object-module-review-list.md) | `object/*`, `data/list` | Review list | Null-prototype hazards, reference aliasing, sentinel collisions, write-swallowing traps, read-mutating observer, and the two unimplemented stubs — one row each, for triage. |
| [0011](./0011-api-surface-and-doc-drift.md) | cross-cutting | Review list | Signature-vs-behavior drift, unreachable branches, unexported public types, barrel surface risks, and every stale line in `knowledge.md`. |
| [0012](./0012-applied-fixes-2026-11.md) | `constants`, `array`, `array/wrapper` | Closed | The six defects that were fixed in the same pass rather than pinned: missing constants, `arrayCreate` hang, lexicographic `keys` sort, `is('invalid')` always-false, `count` `TypeError`, debug `console.log`. |

## Severity vocabulary

- **Blocking** — a plausible consumer path crashes or never settles.
- **Significant** — silently wrong result, or the observable contract
  contradicts the JSDoc / type signature / `knowledge.md`.
- **Minor** — ergonomics, naming, or drift risk with a cheap fix.
- **Review list** — no single fix; rows for the owner to triage.
- **Closed** — already applied in this pass; kept for the evidence trail.

## Rules of the log

- Every claim carries a `path:line` reference. A claim that was **not**
  re-verified by reading the source is marked `unconfirmed`.
- Behavior described in an issue is now **pinned by tests**, so a fix is a
  deliberate, visible change: the named test file is listed under **Tests to
  add** together with the expectations that must be updated.
- An issue is never edited to hide a regression — corrections go in a
  `## Update` section with its own date. Closing an issue moves it to the
  bottom of the index table with the commit that closed it.

## Related

- `knowledge.md` (package root) — the API reference this log repeatedly cites.
- `packages/presource/nexus` — depends on this package; `src/index.ts:19-20`
  records the move.
