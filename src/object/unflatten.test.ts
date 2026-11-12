import { objectFlatten, objectUnflatten } from '@presource/core';

describe('objectUnflatten', () => {
    test('Unflattening objects that already unflattened', () => {
        // Nothing should change. There is nothing to unflatten
        expect(objectUnflatten({ test: [] })).toStrictEqual({ test: [] });
        expect(objectUnflatten({ test: true })).toStrictEqual({ test: true });
        expect(objectUnflatten({ test: 'hi' })).toStrictEqual({ test: 'hi' });
        // Testing with Object
        expect(objectUnflatten({ test: {} })).toStrictEqual({ test: {} });
        expect(objectUnflatten({ test: { example: '1' } })).toStrictEqual({ test: { example: '1' } });
    });

    test('Unflattening simple objects without conflicts', () => {
        // Single Line object. No conflicct
        expect(objectUnflatten({ 'school.year12.subjects': ['english', 'math'] })).toStrictEqual({
            school: {
                year12: {
                    subjects: ['english', 'math']
                }
            }
        });

        // Single line object with conflicts (family)
        expect(
            objectUnflatten({
                'family.mother': { name: 'Jane' },
                'family.father': { name: 'John' }
            })
        ).toStrictEqual({
            family: {
                mother: {
                    name: 'Jane'
                },
                father: {
                    name: 'John'
                }
            }
        });
    });

    test('More complicated object without conflicts', () => {
        // Merging into existing object
        expect(
            objectUnflatten({
                'family.mother': { name: 'Jane' },
                'family.father': { name: 'John' },
                'family.mother.color': 'blue'
            })
        ).toStrictEqual({
            family: {
                mother: {
                    name: 'Jane',
                    color: 'blue'
                },
                father: {
                    name: 'John'
                }
            }
        });
    });

    test('Complicated object with different type of conflicts', () => {
        const example1 = objectUnflatten({
            'family.mother': { name: 'Jane' },
            'family.father': { name: 'John' },
            'family.mother.name': 'Sera'
        });

        // Joining with current object
        expect(example1).toStrictEqual({
            family: {
                mother: {
                    name: ['Jane', 'Sera']
                },
                father: {
                    name: 'John'
                }
            }
        });

        const example2 = objectUnflatten({
            'family.mother': true,
            'family.mother.name': 'Jane'
        });

        expect(example2).toStrictEqual({
            family: {
                mother: {
                    '': true,
                    name: 'Jane'
                }
            }
        });
    });

    test('A single deep dotted key builds the full nested chain', () => {
        expect(objectUnflatten({ 'a.b.c.d': 'deep' })).toStrictEqual({
            a: { b: { c: { d: 'deep' } } }
        });
    });

    test('Object values are recursively unflattened and merged', () => {
        expect(objectUnflatten({ 'a.b': { c: 1 }, 'a.b.d': 2 })).toStrictEqual({
            a: { b: { c: 1, d: 2 } }
        });
        // Two sibling branches under the same parent are both kept
        expect(objectUnflatten({ 'a.x': { v: 1 }, 'a.y': { v: 2 } })).toStrictEqual({
            a: { x: { v: 1 }, y: { v: 2 } }
        });
    });

    test('Colliding scalars are buffered under an empty-string key', () => {
        // A scalar sitting above a deeper chain is preserved as the '' entry
        expect(objectUnflatten({ 'a.b': 1, 'a.b.c': 2 })).toStrictEqual({
            a: { b: { '': 1, c: 2 } }
        });
        // The shallower key lands next to the deeper one without promoting to an array
        expect(objectUnflatten({ 'a.b.c': 1, 'a.b': 3 })).toStrictEqual({
            a: { b: { c: 1, '': 3 } }
        });
        // Sibling leaves under a scalar parent all buffer in order
        expect(objectUnflatten({ a: 1, 'a.b': 2, 'a.c': 3 })).toStrictEqual({
            a: { '': 1, b: 2, c: 3 }
        });
    });

    test('A second value at the same leaf is promoted to an array', () => {
        // The existing scalar is buffered under '' and the new value is appended, so it becomes a list
        expect(objectUnflatten({ 'a.b': { c: 1 }, 'a.b.c': 2 })).toStrictEqual({
            a: { b: { c: [1, 2] } }
        });
        // Arrays are themselves buffered under '' and then merged with the incoming value
        expect(objectUnflatten({ 'a.b': [1, 2], 'a.b.c': 3 })).toStrictEqual({
            a: { b: { '': [1, 2], c: 3 } }
        });
        // A third collision keeps buffering at the deeper node
        expect(objectUnflatten({ 'a.b': { c: 1 }, 'a.b.c': 2, 'a.b.c.d': 3 })).toStrictEqual({
            a: { b: { c: { '': [1, 2], d: 3 } } }
        });
    });

    test('A node holding only the buffer key is hoisted to its parent', () => {
        // '' is the only key, so the wrapper disappears and the value is written directly
        expect(objectUnflatten({ a: 1 })).toStrictEqual({ a: 1 });
        expect(objectUnflatten({ 'a.b': 1 })).toStrictEqual({ a: { b: 1 } });
        // Once another key joins the node, the buffer stays visible
        expect(objectUnflatten({ 'a.b.c': 1, 'a.b': 3, 'a.b.d': 4 })).toStrictEqual({
            a: { b: { c: 1, '': 3, d: 4 } }
        });
    });

    test('Malformed dotted keys keep their empty segments', () => {
        expect(objectUnflatten({ 'a.': 1 })).toStrictEqual({ a: { '': 1 } });
        expect(objectUnflatten({ '.a': 1 })).toStrictEqual({ '': { a: 1 } });
        expect(objectUnflatten({ 'a..b': 1 })).toStrictEqual({ a: { '': { b: 1 } } });
    });

    test('Null and undefined values are kept as explicit keys', () => {
        const output = objectUnflatten({ a: null, b: undefined });

        expect(output).toStrictEqual({ a: null, b: undefined });
        expect(Object.keys(output)).toStrictEqual(['a', 'b']);
    });

    test('A literally undefined buffered value still hoists as a present-but-undefined key', () => {
        // M11: the per-segment / per-value `typeSwitch` dispatch became explicit branches. The
        // empty-string buffer is the one place where a literal `undefined` could diverge, because
        // `current[''] = undefined` creates the key while keeping the value undefined, and the
        // hoist test below it then reads `Object.keys(current).length === 1`.
        const single = objectUnflatten({ 'a.b': undefined });

        expect(Object.keys(single)).toStrictEqual(['a']);
        expect(Object.keys(single.a)).toStrictEqual(['b']);
        expect(single.a.b).toBeUndefined();
        expect('b' in single.a).toBe(true);

        // A buffer that is later overwritten by a deeper chain is replaced by a fresh branch
        expect(objectUnflatten({ 'a.b': undefined, 'a.b.c': 1 })).toStrictEqual({ a: { b: { c: 1 } } });
        // A hoisted undefined leaf stays a present-but-undefined key next to its sibling
        expect(objectUnflatten({ 'a.b.c': undefined, 'a.b.d': 4 })).toStrictEqual({ a: { b: { c: undefined, d: 4 } } });
        expect(Object.keys(objectUnflatten({ 'a.b.c': undefined, 'a.b.d': 4 }))).toStrictEqual(['a']);
        expect(objectUnflatten({ a: undefined, 'a.b': 2 })).toStrictEqual({ a: { b: 2 } });
    });

    test('Non plain-object values are buffered under the empty key, never treated as branches', () => {
        // M11: `isObject` is constructor-strict, exactly like the old `typeSwitch` "object" bucket.
        // Arrays, class instances and prototype-less objects are leaves, so a deeper key below
        // them parks the original value under '' instead of merging into it.
        expect(objectUnflatten({ 'a.b': [1, 2], 'a.b.c': 3 })).toStrictEqual({ a: { b: { '': [1, 2], c: 3 } } });

        class Model {
            x = 1;
        }
        const instance = new Model();
        const withInstance = objectUnflatten({ 'a.b': instance, 'a.b.c': 3 } as any);

        // The instance is buffered by reference under '' rather than merged or copied
        expect(Object.keys(withInstance.a.b)).toStrictEqual(['', 'c']);
        expect(withInstance.a.b['']).toBe(instance);
        expect(withInstance.a.b.c).toBe(3);
    });

    test('Numeric-looking segments stay string keys', () => {
        expect(objectUnflatten({ 'a.0': 'x', 'a.1': 'y' })).toStrictEqual({
            a: { '0': 'x', '1': 'y' }
        });
    });

    test('The input is never mutated and its values are never shared by reference', () => {
        const nested = { deep: 1 };
        const input = { 'a.b': nested };

        const output = objectUnflatten(input);

        expect(input).toStrictEqual({ 'a.b': nested });
        // The rebuilt branch is a fresh object, not the original value instance
        expect(output).not.toBe(input);
        expect(output.a.b).not.toBe(nested);
        expect(output.a.b).toStrictEqual({ deep: 1 });
    });

    test('Round-tripping flatten is lossy when a scalar and a branch collide', () => {
        // The literal already collapses: 'a.b' overwrites the nested branch
        const source: any = { a: { b: 1 }, 'a.b': 2 };

        const flat = objectFlatten(source);
        const back = objectUnflatten(flat);

        expect(flat).toStrictEqual({ 'a.b': 2 });
        expect(back).toStrictEqual({ a: { b: 2 } });
        // One of the two original entries is gone: flatten is not 1-to-1
        expect(back).not.toStrictEqual(source);
    });

    test('Round-tripping a conflict-free nested object is lossless', () => {
        const source = { school: { year12: { subjects: ['english', 'math'] }, name: 'A' } };

        const flat = objectFlatten(source);

        expect(flat).toStrictEqual({ 'school.year12.subjects': ['english', 'math'], 'school.name': 'A' });
        expect(objectUnflatten(flat)).toStrictEqual(source);
    });
});
