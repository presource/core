import { objectSwitch } from '@presource/core';

describe('Object Switch Functionality', () => {
    test('Basic Switch Route', () => {
        const item = {
            a: 'apple',
            b: 'banana'
        };

        expect(objectSwitch(item, { a: () => 'found apple' })).toBe('found apple');
        expect(objectSwitch(item, { b: () => 'found banana' })).toBe('found banana');
        expect(objectSwitch(item, { a: () => 'found apple', b: () => 'found banana' })).toBe('found apple');
        // Switching route is possible due to return value.
        // If value is returned, it will skip the rest of the route!
    });

    test('Multi Switching Route', () => {
        const item = {
            b: 'bat',
            c: 'cat',
            d: 'dog',
            e: 'elephant'
        };

        const result: string[] = [];
        // If no value is being returned, then it will continue to hit all possible keys
        objectSwitch(item, {
            a: () => {
                result.push('a');
            },
            b: () => {
                result.push('b');
            },
            c: () => {
                result.push('c');
            },
            d: () => {
                result.push('d');
            },
            e: () => {
                result.push('e');
            }
        });

        // Expecting the Result to Equal BCDE
        expect(result).toStrictEqual(['b', 'c', 'd', 'e']);
    });

    test('fallback is triggered when no case matches', () => {
        const item = { x: 'unknown' };
        const result = objectSwitch(item, {
            a: () => 'found a',
            default: () => 'fallback triggered'
        });
        expect(result).toBe('fallback triggered');
    });

    test('default case receives params', () => {
        const item = { x: 42 };
        let receivedParams: any;
        objectSwitch(item, {
            a: () => 'found a',
            default: (params) => {
                receivedParams = params;
            }
        });
        // No case matched, so key/value are never added; only the reloop helpers exist
        expect(receivedParams).toStrictEqual({
            a: receivedParams.a,
            default: receivedParams.default
        });
        expect(Object.keys(receivedParams)).toStrictEqual(['a', 'default']);
        expect('key' in receivedParams).toBe(false);
        expect('value' in receivedParams).toBe(false);
        expect(receivedParams.key).toBeUndefined();
        expect(receivedParams.value).toBeUndefined();
        expect(typeof receivedParams.a).toBe('function');
        expect(typeof receivedParams.default).toBe('function');
    });

    test('no fallback returns undefined', () => {
        const result = objectSwitch({ x: 1 }, { a: () => 'a' });
        expect(result).toBeUndefined();
    });

    test('the winner is decided by case insertion order, not by data order', () => {
        // The same data, matched twice with the cases declared in opposite orders
        const data = { b: 1, a: 2 };
        const fired: string[] = [];

        const first = objectSwitch(data, {
            b: () => {
                fired.push('b');
                return 'B';
            },
            a: () => {
                fired.push('a');
                return 'A';
            }
        });
        expect(first).toBe('B');

        const second = objectSwitch(data, {
            a: () => {
                fired.push('a2');
                return 'A2';
            },
            b: () => {
                fired.push('b2');
                return 'B2';
            }
        });
        expect(second).toBe('A2');

        // Only the first matching case of each declaration runs (it returned a value)
        expect(fired).toStrictEqual(['b', 'a2']);
    });

    test('a matching case that returns undefined lets later matching cases run', () => {
        const fired: string[] = [];
        const result = objectSwitch({ b: 1, a: 2 }, {
            b: () => {
                fired.push('b');
            },
            a: () => {
                fired.push('a');
                return 'A';
            }
        });

        // The case walk only breaks on a defined result, so the last defined return wins
        expect(fired).toStrictEqual(['b', 'a']);
        expect(result).toBe('A');
    });

    test('when every matching case returns undefined the result is undefined', () => {
        const fired: string[] = [];
        const result = objectSwitch({ b: 1, a: 2 }, {
            b: () => {
                fired.push('b');
            },
            a: () => {
                fired.push('a');
            }
        });

        expect(fired).toStrictEqual(['b', 'a']);
        expect(result).toBeUndefined();
    });

    test('params carry the matched key and value plus one reloop helper per case key', () => {
        const seen: any[] = [];
        objectSwitch({ hit: 'value' }, {
            hit: (params) => {
                seen.push(params);
                return 'hit';
            },
            other: () => 'other',
            default: () => 'default'
        });

        expect(seen).toHaveLength(1);
        const params = seen[0];
        // Case keys become reloop closures, then key/value are merged in for the matched case
        expect(Object.keys(params)).toStrictEqual(['hit', 'other', 'default', 'value', 'key']);
        expect(params.key).toBe('hit');
        expect(params.value).toBe('value');
        expect(typeof params.other).toBe('function');
        expect(typeof params.default).toBe('function');
    });

    test('a reloop helper re-dispatches the matching case with that case function as the value', () => {
        const order: any[] = [];
        const caseB = (args: any) => {
            // The relooped dispatch builds `{ b: caseB }` as its data, so `value` is the case itself
            order.push({ key: args.key, valueIsCaseB: args.value === caseB, hasAReloop: typeof args.a });
            return 'from-b';
        };

        const result = objectSwitch({ a: 'apple', b: 'banana' }, {
            a: (params) => {
                const relayed = params.b('ignored');
                order.push({ from: 'a', relayed });
                return 'from-a';
            },
            b: caseB
        });

        expect(order).toStrictEqual([
            { key: 'b', valueIsCaseB: true, hasAReloop: 'function' },
            { from: 'a', relayed: 'from-b' }
        ]);
        expect(result).toBe('from-a');
    });

    test('a default reloop helper runs the fallback exactly once', () => {
        let fallbackCalls = 0;
        const result = objectSwitch(
            { a: 1 },
            {
                a: ({ default: relaunch }) => {
                    const relayed = relaunch('anything');
                    return `a->${relayed}`;
                },
                default: (params) => {
                    fallbackCalls++;
                    // The relooped data only holds `default`, so no case matches and key/value are unset
                    return `fallback:${String(params.key)}:${String(params.value)}`;
                }
            }
        );

        expect(fallbackCalls).toBe(1);
        expect(result).toBe('a->fallback:undefined:undefined');
    });

    test('default is skipped entirely when a case matches', () => {
        let fallbackCalls = 0;
        const result = objectSwitch({ a: 1 }, {
            a: () => 'A',
            default: () => {
                fallbackCalls++;
                return 'DEF';
            }
        });

        expect(result).toBe('A');
        expect(fallbackCalls).toBe(0);
    });

    test('inherited keys are not matched', () => {
        function Klass(this: any) {
            this.own = 1;
        }
        (Klass as any).prototype.inherited = 'proto';
        const instance: any = new (Klass as any)();

        const fired: string[] = [];
        const result = objectSwitch(instance, {
            inherited: () => {
                fired.push('inherited');
                return 'PROTO';
            },
            own: () => {
                fired.push('own');
                return 'OWN';
            }
        });

        expect(fired).toStrictEqual(['own']);
        expect(result).toBe('OWN');
    });

    test('a non-function case value throws when it matches', () => {
        let failure: any = null;
        try {
            objectSwitch({ a: 1 }, { a: 'static-value' as any });
        } catch (error: any) {
            failure = { threw: true, name: error.constructor.name };
        }

        // Cases are always invoked, so a static (non-callable) case is a runtime error
        expect(failure).toStrictEqual({ threw: true, name: 'TypeError' });
    });

    test('a non-function case value that never matches is ignored', () => {
        const result = objectSwitch({ b: 1 }, { a: 'static-value' as any, b: () => 'B' });

        expect(result).toBe('B');
    });

    test('non-object data is iterated by own keys and yields no match', () => {
        // Object.keys of a string returns its indexes, none of which match the cases
        expect(objectSwitch('str' as any, { a: () => 'A' })).toBeUndefined();
        // With a fallback the default path is taken instead
        expect(objectSwitch('str' as any, { a: () => 'A', default: () => 'DEF' })).toBe('DEF');
    });

    test('an empty cases object always falls through to undefined', () => {
        expect(objectSwitch({ a: 1 }, {})).toBeUndefined();
        expect(objectSwitch({}, { a: () => 'A', default: () => 'DEF' })).toBe('DEF');
    });

    test('an own default entry is never a match candidate, even when data has a default key', () => {
        // The previous `{ default: fallback, ...rest }` spread removed `default` from the iterated
        // cases, so a data key literally named 'default' can never hit a case slot. The rewritten
        // loop reproduces that by skipping 'default' inline.
        let fallbackParams: any;
        const result = objectSwitch({ default: 'data-value' }, {
            default: (params: any) => {
                fallbackParams = params;
                return 'FALLBACK';
            },
            a: () => 'A'
        });

        expect(result).toBe('FALLBACK');
        // Nothing matched, so the params object only carries the reloop helpers (no key/value)
        expect(Object.keys(fallbackParams)).toStrictEqual(['default', 'a']);
        expect('key' in fallbackParams).toBe(false);
    });

    test('an inherited default still becomes the fallback but never joins the params map', () => {
        // G19: mirror of string/switch.test.ts:105. The fallback used to come out of the
        // `{ default: fallback, ...rest }` destructuring, i.e. a normal property read that walks
        // the prototype chain; the rewritten loop keeps that by reading `cases.default` directly.
        const protoCases: any = Object.create({ default: () => 'inherited-default-fallback' });
        protoCases.a = () => 'own-a';

        // An own case still wins over the inherited fallback
        expect(objectSwitch({ a: 1 }, protoCases)).toBe('own-a');
        // With no own case matching, the inherited default runs
        expect(objectSwitch({ z: 1 }, protoCases)).toBe('inherited-default-fallback');

        let fallbackParams: any;
        const spyCases: any = Object.create({
            default: (params: any) => {
                fallbackParams = params;
                return 'inherited-default-fallback';
            }
        });
        spyCases.a = () => 'own-a';

        expect(objectSwitch({ z: 1 }, spyCases)).toBe('inherited-default-fallback');
        // The params map covers own enumerable keys only, so the inherited `default` has no
        // reloop helper of its own and the walk still skips inherited case keys entirely.
        expect(Object.keys(fallbackParams)).toStrictEqual(['a']);
        expect(typeof fallbackParams.a).toBe('function');
    });
});
