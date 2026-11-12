/**
 * Asynchronous type-switch utility.
 *
 * Inspects the runtime type of a value and dispatches to a matching
 * case callback. Each callback also receives helper methods (e.g.
 * `args.number()`, `args.N()`) so a matched handler can further
 * delegate based on nested types. This is the async counterpart of
 * {@link typeSwitch}.
 *
 * PERF NOTES: same measurements as ./switch.ts (lazy accessor / lazy-proxy args
 * are slower than this eager build; a non-callable case returns without building
 * args at all; the nested helpers come from the module-level factory). The nested
 * helpers stay `async` so they keep returning promises, like the original
 * implementation.
 */

import { typeName } from './name';
import { objectHasKey } from '../object/has';
import { isFunction } from '../is/function';

/**
 * Signature for the async type-switch function.
 * @template T - The type of the value being inspected.
 */
export type TypeSwitchAsync = <T>(unknown: T, cases: Cases<T>) => Promise<any>;

/**
 * Mapping from type-name keys to handler callbacks.
 * Each key corresponds to a constructor name (e.g. "string", "number",
 * "object", "array", "boolean", "null", "undefined", "function").
 * The `default` key is used when no other key matches.
 * @template T - The type of the value being inspected.
 */
type Cases<T> = {
  // Default Case. Trigger when Nothing Else Matches
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
 * Each property is an async callback that, when called, will dispatch
 * to the corresponding case handler with the provided value.
 */
type Nested = {
  // Callback have these function
  default: Callback;

  // Number callback
  number: Callback;

  // String callback
  string: Callback;

  // Boolean Callback
  boolean: Callback;

  // Object callback
  object: Callback;

  // Undefined
  undefined: Callback;

  null: Callback;

  // Array Callback
  array: Callback;

  // Function callback
  function: Callback;
};

/** Standard async callback that an individual nested helper invokes. */
type Callback = (value?: any) => Promise<any>;

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
 * Builds one nested async delegation helper.
 *
 * Module-level factory (see ./switch.ts for the measurement): every helper shares
 * a single function object and a two-slot closure context, which is faster than a
 * closure created inside the loop body while producing an identical args object.
 *
 * @param args - The args object every helper spreads into the next case.
 * @param caseHandler - The case value captured at build time, so later mutations
 *                      of `cases` cannot swap the handler mid-dispatch.
 * @returns The `args[key]` async callback.
 */
const createNestedCallback = (args: any, caseHandler: any): Callback =>
    // `async` keeps the return value a promise like the original, and the optional
    // call keeps the historical failure modes (nullish case value hands back
    // `undefined`, other non-callables reject with
    // `TypeError: caseHandler is not a function`).
    async (val: any) => caseHandler?.({ ...args, value: val });

/**
 * Performs an asynchronous type switch on the given value.
 *
 * Determines the runtime type name of `input`, looks up the
 * corresponding handler in `cases`, and invokes it with an `args`
 * object containing the original value plus nested delegation methods.
 * If the matched case is a function it is awaited; otherwise the
 * raw value is returned directly.
 *
 * @template T - The type of the value being inspected.
 * @param input  - The value whose type will be inspected.
 * @param cases  - An object mapping type names to handler callbacks.
 * @returns The result of the matched case handler.
 */
export const typeSwitchAsync: TypeSwitchAsync = async (input, cases) => {
  const name = resolveCaseName(input);

  // Pick the matching case handler, falling back to `default`
  const caseFunction = objectHasKey(cases, name) ? cases[name] : cases.default;

  // A non-callable case never receives the args object, so it is not built at
  // all; the surrounding `async` still wraps the raw value in a promise.
  if (!isFunction(caseFunction)) return caseFunction;

  // Build the args object that will be passed to the matched handler. The loop is
  // `Object.keys`-driven (own enumerable keys, insertion order with integer keys
  // first) - the same set and order `objectEach` walked - but without that
  // helper's shared parameter object.
  const args: any = { value: input };
  // `Object.keys` widens the declared case keys to `string`, which `Cases<T>` cannot
  // index (it has no index signature). Reading through this record view is a
  // compile-time-only alias of the same object: identical keys, order and values.
  const caseHandlers: Record<string, any> = cases;
  for (const key of Object.keys(cases)) args[key] = createNestedCallback(args, caseHandlers[key]);

  // Invoke the matched handler and await its result.
  return await caseFunction(args);
};
