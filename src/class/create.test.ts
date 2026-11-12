import { classConstructor } from './constructor';
import { classCreate } from './create';

/**
 * Contract source: src/class/create.ts (lines 7-24).
 *
 * Behaviour nailed down here:
 * - The shape is iterated with `objectEach` (object/each.ts:42 → `Object.keys`), so POSITIONAL
 *   arguments are bound by key insertion order. Integer-like keys are reordered ascending.
 * - `val === undefined ? value : val` (create.ts:17) keeps the default only for `undefined` -
 *   `0`, `''`, `false` and `null` arguments all win over the default.
 * - Every shape entry becomes an OWN property, including functions, and extra arguments beyond
 *   the shape length are simply never read.
 * - Reference defaults (arrays/objects) are NOT cloned - every instance shares the shape value.
 * - `properties` is captured by the constructor closure, so mutating the shape object after the
 *   class is created changes the defaults used by the NEXT instance.
 *
 * NOTE: instances are compared with `toEqual`, because `toStrictEqual` also checks the
 * prototype and would reject a generated-class instance against a plain object literal.
 */
describe('Class Creation', () => {
    test('Creating a class without need for constructor', () => {
        // Creating a Person Class with the following information
        const Person = classCreate({
            name: '',
            gender: 'male',
        });

        // No Argument constructor
        const template = new Person();
        expect(template.name).toBe('');
        expect(template.gender).toBe('male');

        // Creating a New Protagonist with only one field updated
        const protagonist = new Person('james');
        expect(protagonist.name).toBe('james');
        expect(protagonist.gender).toBe('male');

        // Creating a Herione with updated fields
        const herione = new Person('lily', 'female');
        expect(herione.name).toBe('lily');
        expect(herione.gender).toBe('female');
    });

    test('Creating a class with inbuild functions', () => {
        // Creating a Class with Building
        const Building = classCreate({
            wood: 5,
            metal: 9,
            // Can totally use inbuild functions
            total(): number {
                // Return the total
                return this.wood + this.metal;
            },
        });

        // Creating a new Building
        const house = new Building();
        expect(house.wood).toBe(5);
        expect(house.metal).toBe(9);
        expect(house.total()).toBe(14);

        // Updating the variables themselves
        const yatch = new Building(5, 6);
        expect(yatch.wood).toBe(5);
        expect(yatch.metal).toBe(6);
        expect(yatch.total()).toBe(11);

        // Overwriting functions
        const barn = new Building(2, 2, () => 5);
        expect(barn.wood).toBe(2);
        expect(barn.metal).toBe(2);
        expect(barn.total()).toBe(5);
    });

    test('methods live on the instance because every shape entry is assigned as an own property', () => {
        const Building = classCreate({
            wood: 5,
            total(): number {
                return this.wood;
            },
        });

        const house = new Building();

        // create.ts:17 assigns ALL keys, so 'total' is an own enumerable property
        expect(Object.keys(house)).toStrictEqual(['wood', 'total']);
        expect(Object.prototype.hasOwnProperty.call(house, 'total')).toBe(true);
        expect(Building.prototype.hasOwnProperty('total')).toBe(false);
        // An explicit undefined argument keeps the default method (create.ts:17 strict check)
        expect(new Building(1, undefined).total()).toBe(1);
    });

    test('only an undefined argument falls back to the default', () => {
        const Point = classCreate({ x: 1, y: 2 });

        // `undefined` is the only value treated as "not provided"
        expect(new Point(undefined, 9)).toEqual({ x: 1, y: 9 });
        // 0 / '' / false / null are all valid overrides
        expect(new Point(0, 0)).toEqual({ x: 0, y: 0 });
        expect(new Point('', false)).toEqual({ x: '', y: false });
        expect(new Point(null, undefined)).toEqual({ x: null, y: 2 });
    });

    test('extra arguments beyond the shape are ignored', () => {
        const Small = classCreate({ a: 'A' });
        const instance = new Small('first', 'second', 'third');

        expect(Object.keys(instance)).toStrictEqual(['a']);
        expect(instance).toEqual({ a: 'first' });

        // Fewer arguments than the shape simply leaves the remaining defaults alone
        const Pair = classCreate({ a: 'A', b: 'B' });
        expect(new Pair('only')).toEqual({ a: 'only', b: 'B' });
    });

    test('positional slots follow Object.keys order of the shape', () => {
        const Reordered = classCreate({ b: 'B', a: 'A' });

        // 'b' was declared first, so it receives the first argument
        expect(new Reordered(1, 2)).toEqual({ b: 1, a: 2 });

        // Integer-like keys are always enumerated in ascending numeric order
        const Numeric = classCreate({ 2: 'two', 1: 'one' });
        const numeric = new Numeric('x', 'y');

        expect(Object.keys(numeric)).toStrictEqual(['1', '2']);
        expect(numeric).toEqual({ 1: 'x', 2: 'y' });
    });

    test('falsy defaults survive and an undefined default still creates the key', () => {
        const Flags = classCreate({ zero: 0, empty: '', no: false, nothing: null, missing: undefined });
        const instance = new Flags();

        expect(Object.keys(instance)).toStrictEqual(['zero', 'empty', 'no', 'nothing', 'missing']);
        expect(instance.zero).toBe(0);
        expect(instance.empty).toBe('');
        expect(instance.no).toBe(false);
        expect(instance.nothing).toBeNull();
        // The key exists even though its value is undefined
        expect('missing' in instance).toBe(true);

        // A single argument only occupies the first slot
        const overridden = new Flags(1);
        expect(overridden.zero).toBe(1);
        expect(overridden.empty).toBe('');
        expect(overridden.no).toBe(false);
    });

    test('an empty shape produces a class with no own properties', () => {
        const Nothing = classCreate({});
        const instance = new Nothing();

        expect(Object.keys(instance)).toStrictEqual([]);
        expect(JSON.stringify(instance)).toBe('{}');
        expect(instance instanceof Nothing).toBe(true);
        // Arguments are dropped entirely when the shape is empty
        expect(new Nothing(1, 2, 3)).toEqual({});
    });

    test('scalar defaults are independent per instance', () => {
        const Person = classCreate({ name: 'anon', age: 0 });
        const first = new Person();
        const second = new Person();

        first.name = 'changed';
        first.age = 42;

        expect(second.name).toBe('anon');
        expect(second.age).toBe(0);
        expect(first).not.toBe(second);
    });

    test('reference defaults are shared because they are never cloned', () => {
        const Bag = classCreate({ tags: [] as string[], meta: { count: 0 } });
        const first = new Bag();
        const second = new Bag();

        // Both instances point at the very same value held by the shape object
        expect(first.tags).toBe(second.tags);
        expect(first.meta).toBe(second.meta);

        first.tags.push('a');
        first.meta.count += 1;

        expect(second.tags).toStrictEqual(['a']);
        expect(second.meta).toEqual({ count: 1 });

        // Passing an argument replaces the shared reference for that instance only
        const own = new Bag(['x'], { count: 9 });
        expect(own.tags).toStrictEqual(['x']);
        expect(own.tags).not.toBe(first.tags);
    });

    test('the shape object is read on every construction', () => {
        const shape = { name: 'anon' };
        const Person = classCreate(shape);

        expect(new Person().name).toBe('anon');

        // The constructor closes over `properties`, so a later edit changes the next defaults
        shape.name = 'mutated';
        expect(new Person().name).toBe('mutated');
        // ...while an explicit argument still wins
        expect(new Person('fixed').name).toBe('fixed');
    });

    test('two generated classes are unrelated prototypes', () => {
        const First = classCreate({ a: 1 });
        const Second = classCreate({ a: 1 });

        expect(new First() instanceof Second).toBe(false);
        expect(new Second() instanceof First).toBe(false);
        expect(First.prototype === Second.prototype).toBe(false);
    });

    test('the generated constructor takes rest arguments and cannot be called without new', () => {
        const Person = classCreate({ name: 'anon' });

        // A rest parameter gives Function.length 0 no matter how many slots the shape has
        expect(Person.length).toBe(0);
        expect(Object.getPrototypeOf(new Person())).toBe(Person.prototype);
        expect(() => (Person as any)()).toThrow(TypeError);
    });

    test('a generated class can be subclassed and reflected by classConstructor', () => {
        const Person = classCreate({ name: 'anon' });
        class Derived extends Person {
            extra = 'yes';
        }

        const instance = new Derived('child');

        expect(instance.name).toBe('child');
        expect(instance.extra).toBe('yes');
        expect(instance instanceof Person).toBe(true);
        // class/constructor.ts resolves back to the generated class itself
        expect(classConstructor(new Person())).toBe(Person);
        expect(classConstructor(instance)).toBe(Derived);
    });
});
