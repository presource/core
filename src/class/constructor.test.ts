import { classConstructor } from './constructor';

/**
 * Contract source: src/class/constructor.ts (lines 4-6) - `Object.getPrototypeOf(instance).constructor`.
 *
 * Behaviour nailed down here:
 * - Primitives are auto-boxed by `Object.getPrototypeOf`, so `5` resolves to `Number`, etc.
 * - A class value is itself a function, so `classConstructor(SomeClass)` returns `Function`.
 * - `null` / `undefined` throw inside `Object.getPrototypeOf`, and a null-prototype object
 *   throws later when `.constructor` is read off `null`.
 * - The lookup always lands on the MOST DERIVED prototype, never on a base class.
 */
describe('Class Constructor', () => {
    class Base {
        kind = 'base';
    }
    class Sub extends Base {
        override kind = 'sub';
    }

    test('Creating a class from an instance', () => {
        // Creating an annonymous class
        const example = new (class A {
            name = 'john';
            gender = 'male';
        })();

        expect(example.name).toBe('john');
        expect(example.gender).toBe('male');

        const test = classConstructor(
            class {
                name = 'john';
                gender = 'male';
            }
        );

        const copy = new (classConstructor(example))();

        expect(copy.name).toBe('john');
        expect(copy.gender).toBe('male');
        // The class value resolves to Function because classes are functions
        expect(test).toBe(Function);
    });

    test('returns the own constructor of an instance', () => {
        expect(classConstructor(new Base())).toBe(Base);
        expect(classConstructor(new Sub())).toBe(Sub);
        // The derived prototype wins over the inherited one
        expect(classConstructor(new Sub())).not.toBe(Base);
    });

    test('plain objects, arrays and built-ins resolve to their global constructors', () => {
        expect(classConstructor({} as any)).toBe(Object);
        expect(classConstructor({ a: 1 } as any)).toBe(Object);
        expect(classConstructor([] as any)).toBe(Array);
        expect(classConstructor(new Date(0))).toBe(Date);
        expect(classConstructor(/a/g)).toBe(RegExp);
        expect(classConstructor(new Map())).toBe(Map);
    });

    test('primitives resolve through their boxed prototype', () => {
        expect(classConstructor(5 as any)).toBe(Number);
        expect(classConstructor('s' as any)).toBe(String);
        expect(classConstructor(true as any)).toBe(Boolean);
        expect(classConstructor(Symbol('x') as any)).toBe(Symbol);
        expect(classConstructor(10n as any)).toBe(BigInt);
    });

    test('functions and classes resolve to Function', () => {
        expect(classConstructor(function named() { } as any)).toBe(Function);
        expect(classConstructor((() => { }) as any)).toBe(Function);
        expect(classConstructor(Base as any)).toBe(Function);
    });

    test('null and undefined throw a TypeError', () => {
        // Object.getPrototypeOf(null) rejects nullish input
        expect(() => classConstructor(null as any)).toThrow(TypeError);
        expect(() => classConstructor(undefined as any)).toThrow(TypeError);
    });

    test('a null-prototype object throws when the constructor is read', () => {
        // getPrototypeOf(Object.create(null)) is null, so `.constructor` is read off null
        expect(() => classConstructor(Object.create(null) as any)).toThrow(TypeError);
    });

    test('the resolved constructor can rebuild an equivalent instance', () => {
        const original = new Sub();
        const Rebuilt = classConstructor(original);

        const rebuilt = new Rebuilt();

        expect(rebuilt.kind).toBe('sub');
        expect(rebuilt instanceof Base).toBe(true);
    });

    test('it follows a manually replaced prototype', () => {
        const detached: any = {};
        Object.setPrototypeOf(detached, Sub.prototype);

        expect(classConstructor(detached)).toBe(Sub);
    });
});
