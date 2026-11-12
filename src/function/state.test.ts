import { functionState } from '@presource/core';

/**
 * Contract under test: `functionState(setting)` (src/function/state.ts).
 *
 * Every `state(input)` allocates a slot: non-function inputs become a getter/setter
 * (`undefined` reads the current value, any defined value is returned and then
 * propagated), function inputs re-run on EVERY call and register their reads as
 * dependencies. Writes only re-run dependents while `values[index] !== value`,
 * which is reference equality.
 *
 * COVERAGE NOTE (state.ts:41-51): the `triggers[triggerIndex] || {}` fallback that used to
 * sit here was unreachable dead code and has been removed. Every stack entry is pushed as a
 * fresh `[]` (state.ts:100) and re-assigned from `triggers[triggerIndex] = trigger`, so with
 * `triggers.length > 0` the last element is always a truthy array. The only live guard is the
 * outer `if (triggers.length)` at state.ts:41 — top level reads run with an empty stack and
 * record nothing (pinned by the last test).
 */
describe('Funtion State Test - Design for Reactivity', () => {
    it('can be used reactively', () => {
        // Creating a new function group
        const state = functionState();

        // Setting The Initial State. Each item will get an amount of 0.
        const apple = state(0);
        const banana = state(0);

        // Testing whether Fruit get rendered or not
        let totalFruits = 0;
        let counter = 0;

        // Reactive State
        const fruits = state(() => {
            // Number of Refresh
            counter++;
            // Chaining Condition. If Apple or Banana is triggered.
            // fruits will be triggered
            const total = apple() + banana();

            // Expecting the Total to be
            expect(total).toBe(totalFruits);
            // Should return something to the body. So fruit is the sum of apple and banana.
            return total;
        });

        // Fruit will be rendered once
        expect(counter).toBe(1);

        // Reactive State
        state(() => {
            fruits();
        });

        // Fruit has been rendered again
        expect(counter).toBe(2);

        totalFruits = 5;
        // Setting Apple to be 5.
        apple(5);

        // Fruit Got Refreshed
        expect(counter).toBe(4);

        totalFruits = 7;
        banana(2);
        // banana(2) re-runs `fruits`, which re-runs inside the dependent listener
        expect(counter).toBe(6);
    });

    it('can be used to update an external object like a scoreboard of sort', () => {
        // Let's create a score board of sort
        const scoreboard: any = {};
        // Building a new state function.
        const state = functionState();

        // Number of student taking classes. Let all put them as 0 for now.
        const english = state(0);
        const math = state(0);
        const chemistry = state(0);
        const physic = state(0);

        // Creating a linking state.
        state(() => {
            // Updating the Scoreboard with number of students
            scoreboard.students = english() + math() + chemistry() + physic();
        });

        // Initial Scoreboard
        expect(scoreboard).toStrictEqual({ students: 0 });
        // 12 student is now taking english.
        english(12);
        // Expecting scoreboard to have 12 students in total.
        expect(scoreboard).toStrictEqual({ students: 12 });
        // Adding more students taking classes
        math(10);
        chemistry(20);
        // Expecting score board be updated.
        expect(scoreboard).toStrictEqual({ students: 42 });
    });

    it('can be used as custom sub state', () => {
        // Creating a new function data
        const state = functionState();

        const strength = state(0);
        const magic = state(0);

        const power = state(() => {
            return strength() + magic();
        });

        expect(power()).toBe(0);
        strength(10);
        expect(power()).toBe(10);

        const attack = () => power() + 10;
        const defense = state(() => {
            return attack() + 5;
        });

        expect(defense()).toBe(25);
        expect(attack()).toBe(20);
    });

    it('reads and writes a plain value slot', () => {
        const state = functionState();
        const apple = state(0);

        expect(apple()).toBe(0);
        // The setter echoes the accepted value back
        expect(apple(5)).toBe(5);
        expect(apple()).toBe(5);

        // Only the first argument is used
        expect(apple(2, 3, 4)).toBe(2);
        expect(apple()).toBe(2);

        // `undefined` is a read, never a write
        expect(apple(undefined)).toBe(2);
        expect(apple()).toBe(2);
    });

    it('re-runs dependents only when the stored value actually changes', () => {
        const state = functionState();
        const apple = state(0);
        const banana = state(0);

        let runs = 0;
        const fruits = state(() => {
            runs++;
            return apple() + banana();
        });

        // The registration itself runs the function once
        expect(runs).toBe(1);

        apple(5);
        expect(runs).toBe(2);
        expect(fruits()).toBe(5);
        // Reading a function slot always re-runs it
        expect(runs).toBe(3);

        // Writing the same value propagates nothing
        apple(5);
        expect(runs).toBe(3);
        expect(apple()).toBe(5);

        apple(7);
        expect(runs).toBe(4);
        expect(fruits()).toBe(7);
        expect(runs).toBe(5);
    });

    it('propagates through a dependent chain with exact recomputed values', () => {
        const state = functionState();
        const apple = state(0);
        const banana = state(0);

        let runs = 0;
        let listenerRuns = 0;
        const seen: number[] = [];

        const fruits = state(() => {
            runs++;
            return apple() + banana();
        });
        const listener = state(() => {
            listenerRuns++;
            seen.push(fruits());
        });

        // fruits ran once for its own registration and once for the listener's
        expect(runs).toBe(2);
        expect(listenerRuns).toBe(1);
        expect(seen).toStrictEqual([0]);

        apple(5);
        expect(runs).toBe(4);
        expect(listenerRuns).toBe(2);
        expect(seen).toStrictEqual([0, 5]);

        // Unchanged write: no dependent runs at all
        apple(5);
        expect(runs).toBe(4);
        expect(listenerRuns).toBe(2);
        expect(seen).toStrictEqual([0, 5]);

        banana(2);
        expect(runs).toBe(6);
        expect(listenerRuns).toBe(3);
        expect(seen).toStrictEqual([0, 5, 7]);
    });

    it('ignores call arguments for a function slot but still re-runs it', () => {
        const state = functionState();
        const source = state(10);

        let runs = 0;
        const doubled = state(() => {
            runs++;
            return source() * 2;
        });

        expect(doubled()).toBe(20);
        expect(runs).toBe(2);

        // Arguments never reach the user function; the slot still re-evaluates
        expect(doubled('a', 'b')).toBe(20);
        expect(runs).toBe(3);

        // A write propagates immediately, before the next explicit read
        expect(source(20)).toBe(20);
        expect(runs).toBe(4);
        expect(doubled()).toBe(40);
        expect(runs).toBe(5);
    });

    it('gates propagation on reference equality for object slots', () => {
        const state = functionState();
        const original = { a: 1 };
        const replacement = { a: 1 };

        const object = state(original);
        let runs = 0;
        const reader = state(() => {
            runs++;
            return object();
        });

        expect(runs).toBe(1);
        expect(reader()).toBe(original);
        expect(runs).toBe(2);

        // An equal-shaped but different reference always propagates
        object(replacement);
        expect(runs).toBe(3);
        expect(object()).toBe(replacement);

        // The very same reference twice propagates only once
        object(replacement);
        expect(runs).toBe(3);
    });

    it('keeps state groups isolated from each other', () => {
        const groupA = functionState();
        const groupB = functionState();

        const valueA = groupA(0);
        let runsA = 0;
        const dependentA = groupA(() => {
            runsA++;
            return valueA();
        });

        const valueB = groupB(0);
        groupB(() => valueB());

        expect(runsA).toBe(1);

        // Writing in the other group cannot touch this one
        valueB(5);
        expect(runsA).toBe(1);
        expect(dependentA()).toBe(0);
        expect(runsA).toBe(2);

        valueA(5);
        expect(runsA).toBe(3);
        expect(dependentA()).toBe(5);
    });

    it('exposes the raw target function for property access on a slot', () => {
        const state = functionState();
        const value = state(1);

        // state.ts only switches on `call`, so the get trap leaks the unproxied target
        expect(typeof (value as any).someProp).toBe('function');
        expect((value as any).someProp).not.toBe(value);
        // Every unknown key resolves to the very same target function instance
        expect((value as any).name).toBe((value as any).someProp);
    });

    it('records nothing when a slot is read outside a dependent run (state.ts:41 guard)', () => {
        const state = functionState();
        const apple = state(0);

        let runs = 0;
        // This slot never reads `apple`, so nothing is added to `chained[apple]`
        const unrelated = state(() => {
            runs++;
            return 1;
        });

        // Top level reads run with an empty `triggers` stack: `triggered` returns
        // without writing, and the `|| {}` fallback on state.ts:43 is skipped
        expect(apple()).toBe(0);
        apple(1);
        apple(2);
        expect(runs).toBe(1);
        expect(apple()).toBe(2);
        expect(unrelated()).toBe(1);
        expect(runs).toBe(2);
    });

    // test('Async data', () => {
    //   // Creating a Function State
    //   const data = functionState();

    //   // Cats and dogs
    //   const cats = data(10);
    //   const dogs = data(10);

    //   const pets = data(async () => {
    //     // Returning the cats and dogs
    //     return cats() + dogs();
    //   });

    //   const owners = data(async () => {
    //     // Await for the count
    //     const count = await pets();
    //     expect(count).toBe(20);
    //   });
    // });
});
