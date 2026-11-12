import { objectPopulate } from './populate';

describe('objectPopulate', () => {
    test('should be defined', () => {
        expect(objectPopulate).toBeDefined();
    });

    test('should return undefined (implementation incomplete)', () => {
        // objectPopulate is incomplete - just verifies it doesn't crash
        const ref = { a: 1 };
        const result = objectPopulate(ref, { b: 2 });
        expect(result).toBeUndefined();
    });

    test('Always returns undefined regardless of the arguments', () => {
        // No argument combination produces a value: the body is a bare `return undefined`
        expect(objectPopulate(undefined, undefined)).toBeUndefined();
        expect(objectPopulate({}, {})).toBeUndefined();
        expect(objectPopulate({ a: 1 }, undefined)).toBeUndefined();
        expect(objectPopulate(null as any, 'string-data' as any)).toBeUndefined();
    });

    test('Does not mutate either input', () => {
        const referenced = { a: 1, nested: { x: 1 } };
        const population = { b: 2, nested: { y: 2 } };

        objectPopulate(referenced, population);

        // Nothing is copied onto the referenced object, and the source stays intact
        expect(referenced).toStrictEqual({ a: 1, nested: { x: 1 } });
        expect(population).toStrictEqual({ b: 2, nested: { y: 2 } });
    });

    test('Does not read any property of its arguments', () => {
        // Throwing accessors prove the stub never touches the objects (not even Object.keys)
        const referenced: any = {};
        const population: any = {};
        Object.defineProperty(referenced, 'boom', {
            enumerable: true,
            configurable: true,
            get: () => {
                throw new Error('referencedObject read');
            }
        });
        Object.defineProperty(population, 'boom', {
            enumerable: true,
            configurable: true,
            get: () => {
                throw new Error('populationData read');
            }
        });

        expect(() => objectPopulate(referenced, population)).not.toThrow();
    });

    test('Leaves matching undefined keys unpopulated', () => {
        const referenced: any = { a: undefined };
        const population = { a: 'value' };

        const result = objectPopulate(referenced, population);

        // The intended behaviour (filling `a`) has not been implemented yet
        expect(result).toBeUndefined();
        expect(referenced).toStrictEqual({ a: undefined });
        expect(Object.keys(referenced)).toStrictEqual(['a']);
        expect(referenced.a).toBeUndefined();
    });
});
