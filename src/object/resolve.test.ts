import { objectResolve } from './resolve';

describe('objectResolve', () => {
    test('should be defined', () => {
        expect(objectResolve).toBeDefined();
    });

    test('should return result object', () => {
        const obj = { a: 1 };
        const result = objectResolve(obj);
        expect(result).toBeDefined();
    });

    test('Always returns an empty object, even for a populated input', () => {
        const input = { a: 1, b: 'two', c: [3], d: { e: 4 } };

        const result = objectResolve(input);

        // The result container is created but nothing is ever written into it
        expect(result).toStrictEqual({});
        expect(Object.keys(result)).toStrictEqual([]);
        expect(result).not.toBe(input);
    });

    test('Template markers in the input are not resolved', () => {
        const input = { a: '{{b}}', b: 'raw' };

        const result = objectResolve(input);

        // No substitution happens and the source strings survive untouched
        expect(result).toStrictEqual({});
        expect(input).toStrictEqual({ a: '{{b}}', b: 'raw' });
        expect(result.a).toBeUndefined();
    });

    test('Function values are returned unresolved as well', () => {
        const callable = () => 'called';
        const input = { lazy: callable };

        expect(objectResolve(input)).toStrictEqual({});
        expect(input.lazy).toBe(callable);
    });

    test('Iterates every own key exactly once in insertion order', () => {
        const visited: string[] = [];
        const input: any = {};
        // Accessor properties make the iteration observable: each read proves one visit
        Object.defineProperty(input, 'zeta', {
            enumerable: true,
            configurable: true,
            get: () => {
                visited.push('zeta');
                return 1;
            }
        });
        Object.defineProperty(input, 'alpha', {
            enumerable: true,
            configurable: true,
            get: () => {
                visited.push('alpha');
                return 2;
            }
        });

        const result = objectResolve(input);

        // objectEach breaks only on a defined return, and the inner callback returns nothing
        expect(visited).toStrictEqual(['zeta', 'alpha']);
        expect(result).toStrictEqual({});
    });

    test('Returns a fresh empty object on every call', () => {
        const first = objectResolve({ a: 1 });
        const second = objectResolve({ a: 1 });

        expect(first).toStrictEqual({});
        expect(second).toStrictEqual({});
        expect(first).not.toBe(second);
    });

    test('An empty input resolves to an empty object', () => {
        expect(objectResolve({})).toStrictEqual({});
    });
});
