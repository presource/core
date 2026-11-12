# 0005 - `arrayWrapper`: `select` mutates the shared filter array and accepts request types it cannot evaluate

> **Status:** Open
> **Severity:** Significant
> **Area:** `src/array/wrapper/**` (`select`, `random`, `retain`, `each`, `index`)
> **Date opened:** 2026-11-04

## Context

`arrayWrapper` is the proxy-backed chainable array facade advertised in
`knowledge.md`: `get / keys / is / count / select / each / random / remove /
retain`, where `select(request)` "adds one more predicate to the active filter
and returns a new wrapper". The other methods all funnel through
`instance.each`, which is how a filter is honored
(`count.ts:40-41` states the reason explicitly: "Use `instance.each` so that any
active `select` filters are applied").

Every method in the family was exercised against 10+ element fixtures in this
pass. Six behaviors turned out to be at odds with the facade's own contract.
The wrapper has effectively no production consumers today (only
`packages/react/material/features/basic-side-bar/BasicSideBar.stories.tsx`), so
this is the cheapest moment in the package's life to settle it.

## Gap

1. **`select` writes into its parent's filter array.** `select.ts:53` takes
   `config.filter || []` and `:54` pushes the new predicate into **that same
   array**; `:76` then builds the child with `{ ...config, filter }`. The child
   config object is new, the array is not. So once a wrapper has a filter, every
   derived `select()` narrows the wrapper it came from: after
   `const child = parent.select(0)`, `parent.get()` returns the *intersected*
   result (observed: `['apple']` → `[]` after a second derivation). A caller who
   passes their own `config` (`wrapper(element, { filter })`, `index.ts:115`)
   has that object's array mutated too.
2. **`select` accepts request types it silently ignores.** The outer `typeSwitch`
   declares `number` (`:57`), `array` (`:59`) and `default: () => true` (`:71`).
   A string, boolean, `null`, `undefined` or **callback** request therefore adds
   a predicate that always returns `true` — `select(({ value }) => false).get()`
   returns the whole array. `Request` is typed as
   "a single value, an array of values, or a callback" (`:30`), and the JSDoc at
   `:45` repeats it, so a documented usage does nothing.
3. **`select` throws for an array of strings or booleans.** The array branch
   (`:59`) destructures `number`, `string`, `boolean` delegating helpers from the
   *outer* switch, but the outer cases object contains only `number`/`array`/
   `default`, so `string` and `boolean` are `undefined`; `:63-64` then calls them
   → `TypeError` at predicate-evaluation time (i.e. lazily, at the next
   `get()`/`each()`, not at the `select()` call). Root cause is shared with
   [0007](./0007-typeswitch-delegation-gaps.md).
4. **`random` ignores the active filter.** `random.ts:25` reads `element` and
   indexes into it directly, unlike every sibling method. So
   `wrapper(arr).select(1).random()` can return an element the filter excludes,
   and the empty/undefined contract is defined against the raw array (`:17-19`).
5. **`retain` can never drop filter-hidden elements.** `retain.ts:37-39` collects
   indexes through `instance.each`, which visits only filtered-in elements, and
   `:41` removes exactly those. Elements excluded by the filter are therefore
   unconditionally retained — `select(0).retain(() => false)` keeps 3 of 4
   elements. The same asymmetry makes `remove`'s index list depend on whether a
   filter is active.
6. **`each` forwards the user callback's return into a short-circuit.**
   `each.ts:53-56` returns `callback(data)` straight out of the `arrayEach`
   callback, and `arrayEach` stops on any non-`undefined` value. The idiomatic
   `wrapper(arr).each((d) => seen.push(d.value))` visits **one** element, because
   `Array#push` returns a number. The same trap makes
   `.each((d) => console.log(d.value))` safe only by luck (`console.log` returns
   `undefined`).
7. **Two advertised capabilities of the proxy are not implemented.** The `Params`
   type declares the `w`/`e`/`c`/`i` aliases (`index.ts:38-44`), but the get trap
   builds only `{ wrapper, element, config, instance }` (`:125-130`), so
   `params.w`/`.e`/`.c`/`.i` are `undefined` for custom callbacks. And the proxy
   target is a placeholder function returning `null` (`:117-119`, comment: "not
   yet implemented"), so calling the instance to unwrap the array yields `null`,
   not the array.

## Why it is the way it is

- The shared filter array looks like an optimization for the "derived wrapper"
  pattern in `:76` — `{ ...config, filter }` reads as if it were a copy-on-write
  config. Nothing else in the package clones an array before pushing to it, so
  this is an oversight rather than a rule.
- `select`'s `default: () => true` is a deliberate-looking "accept everything"
  fallback for an omitted request; the cost is that every *unsupported* request
  type gets the same treatment as "no request". `keys.ts` handles the same
  request union properly (`number`/`string`/`boolean`/`array`, `:46-99`), which
  shows the intended shape.
- `random` reading raw `element` is probably deliberate — choosing among the
  *original* array is defensible — but then `select().random()` should be
  documented as independent, which `:15-22` does not say.
- `each` forwarding the callback result is exactly the `arrayEach` contract
  (`each.ts` and `array/each.ts`'s short-circuit rule), and there is a test
  dedicated to "can break prematurely like standard arrayEach". The gap is that
  the breaking rule is invisible in a chaining facade: `each` is documented
  (`:36`) as returning the instance for chaining, which a short-circuited call
  still does, so nothing warns the caller.
- The `w/e/c/i` aliases exist in the type because the params object was
  historically short-keyed; the get trap was rewritten around long names and the
  type was not updated.

## Evidence

- `src/array/wrapper/methods/select.ts:51-53` — the author's own comment:
  "Reuses (does not clone) the existing filter list: when `config.filter`
  already exists, this push also extends the parent config's filter array".
- `src/array/wrapper/methods/select.ts:54-73,76` — push into the shared array;
  `number`/`array`/`default` cases; `return wrapper(element, { ...config, filter })`.
- `src/array/wrapper/methods/select.ts:59-65` — `string`/`boolean` helpers
  destructured from the outer switch and called in the inner one.
- `src/array/wrapper/methods/select.ts:30,45` — `Request` and the JSDoc both
  advertise "a value, an array of values, or a callback".
- `src/array/wrapper/methods/random.ts:24-27` — `const { element } = params;`
  then `element[index]`, no filter involvement.
- `src/array/wrapper/methods/retain.ts:33-43` — collects through `instance.each`
  (filter-aware) and removes only those indexes.
- `src/array/wrapper/methods/each.ts:38-57` — `arrayEach(element, data => { if
  (valueSelected(data)) return callback(data); })`.
- `src/array/wrapper/methods/count.ts:40-41` — the stated filter-awareness rule
  that `random`/`retain` violate.
- `src/array/wrapper/index.ts:38-44` vs `:125-130` — declared `w/e/c/i` aliases
  vs the params actually built.
- `src/array/wrapper/index.ts:115-119` — `const handler = () => null;` with the
  comment "Placeholder handler for advanced usage (not yet implemented)"; the
  proxy target at `:122` is that handler, so a call on the instance returns
  `null`.
- Pinning tests: `src/array/wrapper/methods/select.test.ts` (aliasing case at
  `:92`, lazy `TypeError` cases, non-filtering request types),
  `random.test.ts` (raw-element behavior, filter-independent),
  `retain.test.ts` (filter-hidden elements kept), `each.test.ts` (short-circuit on
  `'stop'` and on `false`), `src/array/wrapper/index.test.ts` (aliases
  `undefined`; instance call → `null`).

## Proposal

Ordered smallest-first; items 1-2 are the ones that change observable results,
the rest are consistency and honesty:

1. **Clone the filter array in `select`:** `const filter = [...(config.filter ||
   [])]` at `:53`. Derived wrappers then extend a private copy; `:76` is
   unchanged.
2. **Make `select` honor the documented request union:** add `string`
   (keyword → reuse the same keywords as `keys.ts:54-76`), `boolean`
   (truthiness match) and `function` (`request(data, params)` predicate) cases,
   and give `array` a self-contained sub-dispatcher instead of the missing
   `string`/`boolean` helpers (`:59-65`). Keep `default: () => true` only for an
   omitted request; an unsupported type should throw a named error, not filter
   nothing.
3. **Pick one filter policy and state it.** The coherent rule is the one
   `count`/`keys`/`get`/`remove`/`retain` already use: everything operates on the
   filtered view. That means `random` should draw from `instance.get()`
   (`random.ts:24-27`) and `retain` should be defined as "keep elements the
   predicate accepts **within the filtered view**" with the complement removed
   from the raw array — or `retain` should bypass the filter entirely; either is
   defensible, the current mix is not.
4. **Stop forwarding the user callback's return in `each`:** call
   `callback(data)` and only propagate an explicit break sentinel
   (e.g. `if (result === false) return result;`), keeping the documented
   "can break prematurely" test working while making `.each(d => seen.push(v))`
   visit everything. If the raw `arrayEach` contract is preferred, say so in the
   JSDoc at `:30-36` — that is the doc-only close.
5. **Delete or implement the two unimplemented pieces:** remove `w/e/c/i` from
   the `Params` type (`index.ts:38-44`) or populate them in the get trap
   (`:125-130`); make the placeholder handler (`:117-119`) return `element` so
   "call the instance to unwrap" works, or drop the claim and type the instance
   as non-callable.

Alternatives considered and rejected:

- **Freeze `config.filter` and throw on `select` of an already-filtered
  wrapper.** Makes the aliasing loud but breaks the documented chaining use case
  (`select(0).select(2)`), which the tests show working.
- **Rewrite the facade without proxies.** Probably the right long-term shape, but
  it is a full API break and the proxy indirection is what `knowledge.md`
  advertises.

## Acceptance criteria

- `parent.select(x)` never changes what `parent.get()`/`parent.count()` return.
- A caller-supplied `config.filter` array is not mutated by any wrapper method.
- `select(number | array | keyword | boolean | predicate)` each produce the
  documented narrowing; an unsupported request fails loudly.
- `wrapper(a).select(...).random()` and `.retain(...)` behave as the single
  chosen filter policy says, and `knowledge.md` matches it.
- `.each(cb)` where `cb` returns a number (e.g. `push`) visits every filtered
  element; an explicit break still short-circuits.
- `params.w/e/c/i` and the callable instance behave as typed, or the types no
  longer promise them.

## Tests to add

- `src/array/wrapper/methods/select.test.ts` — invert the aliasing case (currently
  `:92` pins that the parent IS narrowed); replace the two `toThrow(TypeError)`
  cases with exact keyword/boolean/predicate results; add the `select(predicate)`
  narrowing case that currently filters nothing.
- `src/array/wrapper/methods/random.test.ts` — filter-dependent draw expectation
  (stub `Math.random` as the existing cases do).
- `src/array/wrapper/methods/retain.test.ts` — replace the "filter-hidden
  elements are kept" case with the chosen policy.
- `src/array/wrapper/methods/each.test.ts` — add the `seen.push(value)` full-visit
  case; keep the sentinel-break case.
- `src/array/wrapper/index.test.ts` — the two alias/instance-call cases
  (`aliases → undefined`, `instance() → null`) flip with the fix.

## Out of scope

- Making the wrapper lazy / non-mutating for `remove` (the in-place mutation of
  the source array is documented and tested).
- Extending `keys`' keyword set.
- Adding `map`/`filter`/`sort` style methods to the facade.
- The `isFunction` name collision this family creates with `src/is/function.ts`
  (tracked in [0011](./0011-api-surface-and-doc-drift.md)).
