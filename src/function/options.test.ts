import { functionOptions } from '@presource/core';

/**
 * Contract under test: `functionOptions(options, parent?)` (src/function/options.ts).
 *
 * The returned value is an `objectProxy` around a callable handler:
 * - `handler({ ... })` builds a CHILD handler that falls back to this one
 * - `handler()` (or any non-object argument, via `typeSwitch`'s default case)
 *   returns the `{ reset, update }` control object
 * - property reads resolve locally first, then from the parent chain, otherwise `undefined`
 *
 * `reset` re-assigns the ORIGINAL options object only — keys added by `update`
 * survive the reset (documented below), and parents never see child additions.
 *
 * The initial options are seeded during construction with `Object.assign(handler, options)`.
 * That single assignment is the source of two pinned quirks asserted at the bottom of this
 * file: option keys colliding with the handler's own read-only function properties
 * (`name`, `length`) throw a `TypeError`, and built-in function metadata
 * (`name`/`length`/`call`/`apply`/`constructor`) leaks through the proxy `get` for keys
 * the options set does not define.
 */
describe('functionOptions requirements', () => {
    // TS7022: example implicitly has type any because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
    const example = functionOptions({
        get: async () => 'hello',
        // TS7023: world implicitly has return type any because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.
        world: async () => {
            // TS7022: value implicitly has type any because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
            const value: string = await example.get();
            return `${value} world!`;
        }
    });

    beforeEach(() => {
        example().reset();
    });

    it('should be able to execute methods correctly', async () => {
        expect(await example.get()).toBe('hello');
        expect(await example.world()).toBe('hello world!');
    });

    it('should be able to update the original methods', async () => {
        example().update({
            get: async () => 'goodbye'
        });

        expect(await example.get()).toBe('goodbye');
        expect(await example.world()).toBe('goodbye world!');
    });

    it('should be allowed to be extendable with newer method', async () => {
        // Function Options allows extending previous configured options
        const extendedExample = example({
            type: async () => 'human'
        });

        expect(await extendedExample.get()).toBe('hello');
        expect(await extendedExample.world()).toBe('hello world!');
        expect(await extendedExample.type()).toBe('human');

        // You can extend it further
        const futherExtended = extendedExample({
            planet: async () => true
        });

        expect(await futherExtended.get()).toBe('hello');
        expect(await futherExtended.world()).toBe('hello world!');
        expect(await futherExtended.type()).toBe('human');
        expect(await futherExtended.planet()).toBe(true);
    });

    it('child handlers inherit parent methods by identity', async () => {
        const parent = functionOptions({ a: async () => 1 });
        const child = parent({ b: async () => 2 });

        // The verified inheritance fact
        expect(await child.a()).toBe(1);
        expect(await child.b()).toBe(2);
        expect(await parent.a()).toBe(1);

        // Inheritance resolves the very same function reference from the parent handler
        expect(child.a).toBe(parent.a);
        expect(typeof (child as any).b).toBe('function');
    });

    it('returns undefined for keys that exist on neither handler', () => {
        const parent = functionOptions({ a: async () => 1 });
        const child = parent({ b: async () => 2 });

        expect((child as any).missing).toBeUndefined();
        expect((parent as any).missing).toBeUndefined();
    });

    it('a child may override a parent key without touching the parent', async () => {
        const parent = functionOptions({ a: async () => 1 });
        const child = parent({ a: async () => 99 });

        expect(await child.a()).toBe(99);
        expect(await parent.a()).toBe(1);

        // Extending never mutates the parent handler itself
        expect((parent as any).b).toBeUndefined();
    });

    it('three level nesting resolves up the chain and never down', async () => {
        const lvl1 = functionOptions({ one: async () => 1 });
        const lvl2 = lvl1({ two: async () => 2 });
        const lvl3 = lvl2({ three: async () => 3 });

        expect(await lvl3.one()).toBe(1);
        expect(await lvl3.two()).toBe(2);
        expect(await lvl3.three()).toBe(3);

        // Parents cannot reach into their children
        expect((lvl2 as any).three).toBeUndefined();
        expect((lvl1 as any).two).toBeUndefined();
        expect((lvl1 as any).three).toBeUndefined();

        // Siblings stay isolated from each other
        const siblingA = lvl1({ a: async () => 'A' });
        const siblingB = lvl1({ b: async () => 'B' });
        expect(await siblingA.a()).toBe('A');
        expect((siblingA as any).b).toBeUndefined();
        expect(await siblingB.b()).toBe('B');
        expect((siblingB as any).a).toBeUndefined();
    });

    it('exposes exactly the reset and update controls when called with no arguments', () => {
        const options = functionOptions({ v: async () => 'v' });
        const control: any = options();

        expect(Object.keys(control)).toStrictEqual(['reset', 'update']);
        expect(typeof control.reset).toBe('function');
        expect(typeof control.update).toBe('function');
        // Both controls return undefined
        expect(control.update({})).toBeUndefined();
        expect(control.reset()).toBeUndefined();
    });

    it('update writes onto the handler and reset restores the original options', async () => {
        const options = functionOptions({ v: async () => 'orig' });

        // State before
        expect(await options.v()).toBe('orig');

        options().update({ v: async () => 'updated', extra: async () => 'E' });

        // State after update
        expect(await options.v()).toBe('updated');
        expect(await options.extra()).toBe('E');

        options().reset();

        // reset re-assigns the original options; the extra key added by update survives
        expect(await options.v()).toBe('orig');
        expect(await options.extra()).toBe('E');
    });

    it('child updates never leak into the parent, and parent updates do reach the child', async () => {
        const lvl1 = functionOptions({ one: async () => 1 });
        const lvl2 = lvl1({ two: async () => 2 });
        const lvl3 = lvl2({ three: async () => 3 });

        // Mutating the deepest handler only
        lvl3().update({ two: async () => 200 });
        expect(await lvl3.two()).toBe(200);
        expect(await lvl2.two()).toBe(2);
        expect((lvl1 as any).two).toBeUndefined();

        // reset on the child only restores ITS OWN options, so the override survives
        lvl3().reset();
        expect(await lvl3.two()).toBe(200);
        expect(await lvl3.three()).toBe(3);

        // A parent update is visible through the child fallback
        lvl1().update({ one: async () => 111 });
        expect(await lvl1.one()).toBe(111);
        expect(await lvl2.one()).toBe(111);
        expect(await lvl3.one()).toBe(111);
    });

    it('any non-object argument returns the control object instead of a child', () => {
        const options = functionOptions({ x: async () => 'x' });

        // typeSwitch has no `string`/`number`/`array` case here, so the default runs
        for (const input of ['str', 5, [], true, null, undefined] as any[]) {
            const control: any = options(input);
            expect(Object.keys(control)).toStrictEqual(['reset', 'update']);
            expect(control.x).toBeUndefined();
        }

        // An object argument is the only way to build a child
        const child: any = options({ y: async () => 'y' });
        expect(typeof child).toBe('function');
        expect(child.x).toBe(options.x);
    });

    it('the handler is callable and the child is a distinct object', async () => {
        const parent = functionOptions({ p: async () => 'p' });
        const child: any = parent({ c: async () => 'c' });

        expect(typeof parent).toBe('function');
        expect(child).not.toBe(parent);
        expect(await child.p()).toBe('p');
        expect(await child.c()).toBe('c');
    });

    // ------------------------------------------------------------------
    // G10 PINNED CONTRACT — option keys that collide with the handler's OWN
    // Function properties. The options are seeded with `Object.assign(handler, options)`
    // (src/function/options.ts, construction path). `name` and `length` are own,
    // non-writable data properties of a function object, so the strict-mode [[Set]]
    // inside `Object.assign` throws a TypeError out of the CONSTRUCTOR call
    // (before the proxy exists). This pins documented behaviour; it is not "fixed".
    // ------------------------------------------------------------------
    it('option keys colliding with own function properties throw a TypeError', () => {
        expect(() => functionOptions({ name: async () => 1 } as any)).toThrow(TypeError);
        expect(() => functionOptions({ name: async () => 1 } as any)).toThrow(/Cannot assign to read only property 'name'/);

        expect(() => functionOptions({ length: async () => 1 } as any)).toThrow(TypeError);
        expect(() => functionOptions({ length: async () => 1 } as any)).toThrow(/Cannot assign to read only property 'length'/);

        // Extending a child hits the same assignment on the child handler
        const parent = functionOptions({ p: async () => 'p' });
        expect(() => (parent as any)({ name: async () => 'child-name' })).toThrow(TypeError);
    });

    // `call` / `apply` / `constructor` / `prototype` are only INHERITED by the handler,
    // so `Object.assign` just creates an own property: no throw, and the option wins.
    it('option keys that are merely inherited do not throw and shadow the built-in', async () => {
        for (const key of ['call', 'apply', 'constructor', 'prototype']) {
            expect(() => functionOptions({ [key]: async () => key } as any)).not.toThrow();
        }

        const shadowed: any = functionOptions({ call: async () => 'myCall' });
        expect(shadowed.call).not.toBe(Function.prototype.call);
        expect(await shadowed.call()).toBe('myCall');
    });

    // ------------------------------------------------------------------
    // G10 PINNED CONTRACT — proxy `get` metadata passthrough (src/function/options.ts
    // get trigger): a truthy `currentObject[key]` is returned verbatim, so built-in
    // function metadata leaks through for keys the options set does not define.
    // Both truthy metadata and absent keys are pinned, because an absent key falls
    // through to the (missing) parent lookup and yields `undefined`.
    // ------------------------------------------------------------------
    it('exposes function metadata for keys the options set lacks', () => {
        const options: any = functionOptions({ v: async () => 'v' });

        // The raw handler is an arrow with one optional parameter, declared as `const handler`
        expect(options.length).toBe(1);
        expect(options.name).toBe('handler');
        // Truthy inherited built-ins are handed back as the very same references
        expect(options.call).toBe(Function.prototype.call);
        expect(options.apply).toBe(Function.prototype.apply);
        expect(options.constructor).toBe(Function);
        // An absent key is falsy, so the trigger falls through to the (missing) parent
        expect(options.missing).toBeUndefined();
    });

    it('metadata keys still resolve identically on a child handler', async () => {
        const parent: any = functionOptions({ p: async () => 'p' });
        const child: any = parent({ c: async () => 'c' });

        // The child is built by the same factory, so it carries the same function metadata
        expect(child.length).toBe(1);
        expect(child.name).toBe('handler');
        expect(child.call).toBe(Function.prototype.call);
        // ... while real methods still resolve locally first, then from the parent
        expect(await child.c()).toBe('c');
        expect(child.p).toBe(parent.p);
    });
});
