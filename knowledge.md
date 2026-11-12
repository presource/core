# @presource/core Knowledge

Core JavaScript/TypeScript utility library — the foundational layer for the entire presource ecosystem.

> **Last verified:** 2026-06-19
> **Package name:** `@presource/core`
> **Dependencies:** None (zero runtime deps)
> **Workspace consumers:** `@presource/utility`, `@presource/node`, `@presource/structure`, `@library/presource`, `@library/userfiction`, `@library/cloud`, `@library/test`, `@reloaded/headless`, `@reloaded/material`, `@library/workflow`

---

## How to Update This File

1. Read `src/index.ts` to find current module exports
2. Each module is in its own directory under `src/`
3. Verify function signatures against source files
4. Update the "Last verified" date
5. Keep descriptions concise — focus on what each function DOES, not implementation details

---

## Index

### Type — Type Inspection & Dispatch
- [typeName](#typename) — Get lower-case constructor name
- [typeSwitch](#typeswitch) — Core type-based switch dispatcher
- [typeSwitchAsync](#typeswitchasync) — Async variant

### Is — Type Guards
- [isBoolean](#isboolean), [isString](#isstring), [isNumber](#isnumber), [isObject](#isobject), [isFunction](#isfunction), [isInvalid](#isinvalid), [isValid](#isvalid), [isEmpty](#isempty)

### Conditions
- [ifTrue](#iftrue), [ifFalse](#iffalse), [ifThen](#ifthen)

### Boolean
- [booleanTrue](#booleantrue), [booleanPartialTrue](#booleanpartialtrue), [booleanPartialFalse](#booleanpartialfalse)

### String
- [stringCapitalize](#stringcapitalize), [stringSwitch](#stringswitch), [stringIncludes](#stringincludes), [stringReverse](#stringreverse)

### Array
- [arrayCreate](#arraycreate), [arrayEach](#arrayeach), [arrayEachAsync](#arrayeachasync), [arrayEnsures](#arrayensures), [arrayRequeue](#arrayrequeue), [arrayShuffle](#arrayshuffle), [arrayWrapper](#arraywrapper)

### Object
- [objectEach](#objecteach), [objectEachAsync](#objecteachasync), [objectEnsures](#objectensures), [objectExtract](#objectextract), [objectFilter](#objectfilter), [objectFlatten](#objectflatten), [objectHasKey](#objecthaskey), [objectMap](#objectmap), [objectMapKeys](#objectmapkeys), [objectMerge](#objectmerge), [objectObserve](#objectobserve), [objectProxy](#objectproxy), [objectRegistry](#objectregistry), [objectScan](#objectscan), [objectShuffle](#objectshuffle), [objectSwitch](#objectswitch), [objectTransform](#objecttransform), [objectTrigger](#objecttrigger), [objectUnflatten](#objectunflatten), [objectUpdate](#objectupdate), [objectAlias](#objectalias), [objectCreate](#objectcreate), [objectFill](#objectfill)

### Function
- [functionChain](#functionchain), [functionControl](#functioncontrol), [functionCurry](#functioncurry), [functionDelay](#functiondelay), [functionOptions](#functionoptions), [functionPipe](#functionpipe), [functionProxy](#functionproxy), [functionQueue](#functionqueue), [functionState](#functionstate)

### JSON
- [jsonStringify](#jsonstringify), [jsonTable](#jsontable), [jsonUpdate](#jsonupdate)

### Data
- [dataClone](#dataclone), [dataList](#datalist)

### Loop
- [loopFor](#loopfor), [loopForAsync](#loopforasync), [loopWhile](#loopwhile), [loopUntil](#loopuntil)

### Number
- [numberEnsures](#numberensures)

### Promise
- [promiseCreate](#promisecreate)

### Script
- [scriptAsync](#scriptasync), [scriptChain](#scriptchain), [scriptPause](#scriptpause), [scriptResolve](#scriptresolve)

### Task
- [taskCompletion](#taskcompletion)

### To
- [toString](#tostring)

### Constants
- [EMPTY_STRING](#empty_string), [SPACE_STRING](#space_string), [NUMBERS_STRING](#numbers_string), [ALPHABET_STRING](#alphabet_string)

### Class
- [classConstructor](#classconstructor), [classCreate](#classcreate)

---

## Type — Type Inspection & Dispatch

### typeName
Returns the lower-case constructor name of a value.

```ts
typeName('hello')     // 'string'
typeName(42)          // 'number'
typeName(null)        // 'null'
typeName(undefined)   // 'undefined'
typeName([1,2,3])     // 'array'
```

### typeSwitch
Core utility — synchronous type-based switch with nested delegation helpers.

```ts
import { typeSwitch } from '@presource/core';

const result = typeSwitch(value, {
    string: (args) => args.string(),      // access as string
    number: (args) => args.number(),      // access as number
    object: (args) => args.object(),      // access as object
    array: (args) => args.array(),        // access as array
    default: () => 'unknown'
});
```

**Supported cases:** `string`, `number`, `boolean`, `object`, `array`, `function`, `undefined`, `null`, `default`

### typeSwitchAsync
Async variant of `typeSwitch`.

---

## Is — Type Guards

```ts
import { isBoolean, isString, isNumber, isObject, isFunction, isInvalid, isValid, isEmpty } from '@presource/core';

isBoolean(true)      // true
isString('hello')    // true
isNumber(42)         // true
isObject({})         // true
isFunction(() => {}) // true
isInvalid(null)      // true
isValid('hello')     // true
isEmpty('')          // true
isEmpty([])          // true
isEmpty({})          // true
```

---

## Conditions

### ifTrue / ifFalse
Invoke callback when value is truthy/falsy.

```ts
ifTrue(value, (v) => console.log('truthy:', v));
ifFalse(value, () => console.log('falsy'));
```

### ifThen
Recursive if-then construct.

```ts
ifThen(
    (callback) => isString(value) && callback(),
    () => console.log('is string')
);
```

---

## Boolean

### booleanTrue
Returns true only if ALL conditions are truthy.

### booleanPartialTrue
Returns true if ANY condition is truthy (recursive for nested objects).

### booleanPartialFalse
Returns true if ANY condition is falsy (recursive for nested objects).

---

## String

### stringCapitalize
Capitalizes a character position in every space-separated word. Supports negative indices.

```ts
stringCapitalize('hello world', 0)  // 'Hello World'
stringCapitalize('hello world', -1) // 'hellO worlD'
```

### stringSwitch
String-based switch/case dispatcher.

```ts
stringSwitch(value, {
    'active': () => 'green',
    'inactive': () => 'red',
    default: () => 'gray'
});
```

### stringIncludes
Checks if any case keys appear as substrings.

```ts
const result = stringIncludes('hello world', {
    hello: () => 'greeting',
    world: () => 'location'
});
// result: { hello: 'greeting' }
```

### stringReverse
```ts
stringReverse('hello')  // 'olleh'
```

---

## Array

### arrayCreate
Creates an array: number = fixed length, callback = factory, nothing = empty.

### arrayEach / arrayEachAsync
Synchronous/async iteration with short-circuit on non-undefined return.

### arrayEnsures
Normalizes any value into an array.

### arrayRequeue
Rotates array by moving first element to end (mutates).

### arrayShuffle
Returns new shuffled array using Fisher-Yates (non-mutating).

### arrayWrapper
Creates a proxy-based array wrapper with chainable methods: `get`, `keys`, `is`, `count`, `select`, `each`, `random`, `remove`, `retain`.

---

## Object

### objectEach / objectEachAsync
Synchronous/async iteration over own enumerable properties.

### objectEnsures
Coerces any value to a plain object.

### objectExtract
Extracts values using dot-notation paths with bracket indexing.

```ts
objectExtract({ a: { b: [1, 2] } }, 'a.b[0]')  // 1
```

### objectFilter
Returns new object with only truthy-callback properties.

### objectFlatten / objectUnflatten
Converts nested object to flat dot-separated keys and back.

### objectHasKey
Type-guard: checks if object has own property.

### objectMap / objectMapKeys
Transforms values/keys while preserving the other.

### objectMerge
Deep-merges multiple objects recursively.

### objectObserve
Creates a reactive Proxy observer — every get/set fires a callback.

### objectProxy
Wraps object in a Proxy with configurable get/set interceptors.

### objectRegistry
Creates a polymorphic fluent accessor for key-value storage.

### objectScan
Deep recursive scan with replacement support.

### objectShuffle
Returns new object with shuffled key order.

### objectSwitch
Switch-case over object keys.

### objectTransform
Iterative transform with dependency resolution.

### objectTrigger
Invokes trigger callbacks for matching keys.

### objectUpdate
Shallow overwrite — mutates and returns for chaining.

### objectAlias
Creates a proxy where alias keys resolve to real keys.

### objectCreate
Creates object from key spec and value source.

### objectFill
Adds missing properties from fill into object.

---

## Function

### functionChain
Creates a chainable fluent API.

### functionControl
Creates a callable proxy where property access delegates to callback.

### functionCurry
Curries a multi-argument function (one arg at a time).

### functionDelay
Wraps `setTimeout` with self-rescheduling.

### functionOptions
Creates extensible composable options with parent inheritance.

### functionPipe
Composes functions left-to-right.

### functionProxy
Wraps a function with Proxy to intercept call, get, set.

### functionQueue
Sequential function queue with lifecycle listeners.

### functionState
React-inspired state management for functions — tracks dependencies, auto-re-executes dependents.

---

## JSON

### jsonStringify
JSON stringification with type-aware delegation.

### jsonTable
In-memory JSON table with O(1) CRUD. Supports dynamic id fields, closest-match find, upsert add, swap-delete.

### jsonUpdate
Recursive deep-merge of JSON values. Arrays merge by index, objects by key.

---

## Data

### dataClone
Deep clone of arrays, objects, and primitives. No shared references.

### dataList
Creates an observable wrapper around a plain object with per-field callbacks.

---

## Loop

### loopFor / loopForAsync
Synchronous/async count-driven for-loop with short-circuit.

### loopWhile
While-loop abstraction — continues while condition returns true.

### loopUntil
Until-loop abstraction — runs until condition returns true.

---

## Script

### scriptAsync
Async task runner with concurrent execution and auto-retry.

### scriptChain
Sequential callback relay — object keys become enqueueable methods.

### scriptPause
Returns a promise that resolves after N milliseconds.

### scriptResolve
Polling/retry — repeatedly calls callback until valid value or retries exhausted.

---

## Task

### taskCompletion
Bounded-concurrency async task queue with completion tracking.

---

## Constants

```ts
EMPTY_STRING    // ''
SPACE_STRING    // ' '
NUMBERS_STRING  // '0123456789'
ALPHABET_STRING // 'abcdefghijklmnopqrstuvwxyz'
NULL_STRING     // 'null'
UNDEFINED_STRING // 'undefined'
```

---

## Class

### classConstructor
Returns the constructor function of a class instance.

### classCreate
Dynamically creates a class from an object shape.
