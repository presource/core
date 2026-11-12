import * as classModule from './index';
import { classConstructor, classCreate } from '@presource/core';

/**
 * src/class/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the two `export *` lines in
 * src/class/index.ts (lines 1-2) and the runtime exports of each source file:
 *   ./constructor -> classConstructor  (src/class/constructor.ts:4)
 *   ./create      -> classCreate       (src/class/create.ts:7)
 *
 * NOTE: the `ClassConstructor`/`ClassCreate` signature types in those files are declared
 * locally WITHOUT the `export` keyword, so they are not part of the public surface at
 * all — runtime or otherwise.
 */
const EXPECTED_EXPORTS = ['classConstructor', 'classCreate'];

describe('class barrel (src/class/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(classModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(classModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel bindings are the same implementations the root barrel exposes', () => {
        expect(classModule.classConstructor).toBe(classConstructor);
        expect(classModule.classCreate).toBe(classCreate);
    });

    test('the re-exported implementations still behave (constructor identity + created class)', () => {
        class Sample {
            constructor(public value = 0) {}
        }
        // classConstructor walks the prototype chain back to the constructor function
        expect(classModule.classConstructor(new Sample(3))).toBe(Sample);
        // classCreate builds a class whose instances carry the given defaults
        const Created = classModule.classCreate({ alpha: 1, beta: 'two' }) as new () => any;
        const instance = new Created();
        expect(instance).toBeInstanceOf(Created);
        expect({ alpha: instance.alpha, beta: instance.beta }).toStrictEqual({ alpha: 1, beta: 'two' });
    });
});
