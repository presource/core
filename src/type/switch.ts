/**
 * Synchronous type-switch utility.
 *
 * Inspects the runtime type of a value and dispatches to a matching
 * case callback. Each callback also receives helper methods (e.g.
 * `args.number()`, `args.N()`) so a matched handler can further
 * delegate based on nested types. For the async variant see
 * {@link typeSwitchAsync}.
 *
 * PERF NOTES (measured, paired in-process against the pre-optimisation build):
 * - The args object is built eagerly with a plain `Object.keys` loop. Two lazy
 *   variants were tried and are SLOWER, so do not re-introduce them:
 *     * `Object.defineProperty` accessors per key  -> ~0.63x
 *     * a lazy `Proxy` + module-level traps          -> 0.07x-0.12x once a handler
 *       spreads the args (`{ ...args }`, i.e. every nested delegation), because a
 *       proxy spread costs one `ownKeys` + one `getOwnPropertyDescriptor` + one
 *       `get` trap call per key plus the seal materialisation.
 *   The eager build only allocates the same one closure per declared case key the
 *   original implementation allocated, so it is never worse, and the nested /
 *   spread paths keep V8's fast plain-object spread.
 * - A non-callable case returns without building args at all (the handler can
 *   never observe the object): ~1.5x for small case maps, ~3.5x for large ones.
 * - Each nested helper comes from the module-level `createNestedCallback` factory
 *   rather than a closure created in the loop body: same object, ~1.1x-1.5x faster
 *   on the nested / spread paths because the closures share one function object.
 * - `typeName` is skipped entirely for `null` / `undefined` inputs and is itself
 *   constructor-cached (see ./name.ts).
 * - Observable side effect of skipping the unused work: a `cases` object whose
 *   values are GETTERS is read FEWER times (never more) - a function case reads the
 *   matched key twice and each other key once (2/1/1) instead of the original
 *   2/1/2, and a static case now reads only the matched key (1/0/0 instead of
 *   2/1/2). Every returned value is unchanged; only getter / Proxy-trap call
 *   counts move, which is the intended saving.
 */
import { typeName } from './name';
import { objectHasKey } from '../object';
import { isFunction } from '../is';

/**
 * Mapping from type-name keys to handler callbacks.
 * Each key corresponds to a constructor name (e.g. "string", "number",
 * "object", "array", "boolean", "null", "undefined", "function").
 * The `default` key is used when no other key matches.
 * @template T - The type of the value being inspected.
 */
type Cases<T> = {
    default?: (args: { value: T } & Nested) => any;
    undefined?: (args: Nested) => any;
    null?: (args: Nested) => any;
    string?: (args: { value: string } & Nested) => any;
    number?: (args: { value: number } & Nested) => any;
    array?: (args: { value: any[] } & Nested) => any;
    boolean?: (args: { value: boolean } & Nested) => any;
    object?: (args: { value: { [key: string]: any } } & Nested) => any;
    function?: (args: { value: (...args: any[]) => void } & Nested) => any;
};

/**
 * Nested delegation helpers injected into each case callback's `args`.
 * Each property is a sync callback that, when called, will dispatch
 * to the corresponding case handler with the provided value.
 */
type Nested = {
    default: Callback;

    number: Callback;

    string: Callback;

    boolean: Callback;

    object: Callback;

    undefined: Callback;

    null: Callback;

    array: Callback;

    function: Callback;
};

/** Standard sync callback that an individual nested helper invokes. */
type Callback = (value?: any) => any;

/**
 * Signature for the synchronous type-switch function.
 * @template T - The type of the value being inspected.
 */
type TypeSwitch = <T>(value: T, cases: Cases<T>) => any;

/**
 * Resolves the case key for `input`.
 *
 * `null` / `undefined` never have a constructor, so their names are answered
 * without touching `typeName` at all; every other value goes through the
 * constructor-cached {@link typeName}.
 *
 * @param input - The value whose case key is needed.
 * @returns The type name used to look the case up (`''` becomes `'null'`).
 */
const resolveCaseName = (input: any): string => {
    if (input === undefined) return 'undefined';
    if (input === null) return 'null';
    // typeName returns '' for constructor-less values (e.g. Object.create(null));
    // those have always been routed to the `null` case.
    const name = typeName(input);
    return name === '' ? 'null' : name;
};

/**
 * Builds one nested delegation helper.
 *
 * The factory is module-level on purpose: every helper then shares a single
 * function object and a two-slot closure context instead of a closure created
 * inside the `for` body, which V8 compiles with a per-iteration context. Measured
 * 1.09x-1.48x faster than the in-loop closure (and 0.96x-1.18x faster than the
 * original `objectEach` build) on the nested / spread paths, while producing a
 * byte-identical args object.
 *
 * @param args - The args object every helper spreads into the next case.
 * @param caseHandler - The case value captured at build time, so later mutations
 *                      of `cases` cannot swap the handler mid-dispatch.
 * @returns The `args[key]` callback.
 */
const createNestedCallback = (args: any, caseHandler: any): Callback =>
    // `{ ...args, value: val }` and the optional call are load-bearing: they keep
    // the historical outcomes (nullish case value hands back `undefined`, other
    // non-callables throw `TypeError: caseHandler is not a function`) and the
    // fresh-object semantics of a nested delegation.
    (val: any) => caseHandler?.({ ...args, value: val });

/**
 * Performs a synchronous type switch on the given value.
 *
 * Determines the runtime type name of `input`, looks up the
 * corresponding handler in `cases`, and invokes it with an `args`
 * object containing the original value plus nested delegation methods.
 * If the matched case is a function it is called synchronously;
 * otherwise the raw value is returned directly.
 *
 * @template T - The type of the value being inspected.
 * @param input - The value whose type will be inspected.
 * @param cases - An object mapping type names to handler callbacks.
 * @returns The result of the matched case handler.
 */
export const typeSwitch: TypeSwitch = (input, cases) => {
    const name = resolveCaseName(input);

    // Pick the matching case handler, falling back to `default`
    const caseFunction = objectHasKey(cases, name) ? cases[name] : cases.default;

    // A non-callable case never receives the args object, so it is not built at
    // all. This is the only structural saving available: the eager helper loop
    // below allocates exactly what the original implementation allocated.
    if (!isFunction(caseFunction)) return caseFunction;

    // Build the args object that will be passed to the matched handler. The loop
    // is `Object.keys`-driven (own enumerable keys, in insertion order with
    // integer keys first) - the same set and order `objectEach` walked - but
    // without that helper's shared parameter object.
    const args: any = { value: input };
    // `Object.keys` widens the declared case keys to `string`, which `Cases<T>` cannot
    // index (it has no index signature). Reading through this record view is a
    // compile-time-only alias of the same object: identical keys, order and values.
    const caseHandlers: Record<string, any> = cases;
    for (const key of Object.keys(cases)) args[key] = createNestedCallback(args, caseHandlers[key]);

    // Invoke the matched handler with the fully populated args object.
    return caseFunction(args);
};
