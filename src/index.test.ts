import * as core from './index';

// Direct deep-module imports used to prove the root barrel re-exports the SAME
// implementations rather than copies/shadows (identity assertions below).
import { arrayCreate, arrayEach, arrayEnsures, arrayRequeue, arrayShuffle, arrayWrapper } from './array';
import { booleanCases } from './boolean';
import { classConstructor } from './class';
import { ifTrue } from './conditions';
import { EMPTY_STRING, SPACE_STRING, NUMBERS_STRING, ALPHABET_STRING, NULL_STRING, UNDEFINED_STRING } from './constants';
import { dataClone } from './data';
import { functionChain } from './function';
import { isString } from './is';
import { jsonStringify } from './json';
import { loopFor } from './loop';
import { numberEnsures } from './number';
import { objectMerge } from './object';
import { promiseCreate } from './promise';
import { scriptPause } from './script';
import { stringReverse } from './string';
import { taskCompletion } from './task';
import { toString } from './to';
import { typeSwitch } from './type';

/**
 * Root barrel contract (src/index.ts).
 *
 * src/index.ts re-exports 18 submodule barrels (lines 7-28: array, boolean, class,
 * conditions, constants, data, function, is, json, loop, number, object, promise,
 * script, string, task, to, type). './nexus' is intentionally absent — it now lives in
 * the standalone @presource/nexus package (index.ts:19-20).
 *
 * `EXPECTED_EXPORTS` is the hand-derived union of the runtime (non-type) exports of all
 * 18 barrels, i.e. the concatenation of every per-module list asserted in
 * src/<module>/index.test.ts. It is NOT generated from a test run: an accidental
 * addition, rename, removal, or an `export *` collision that silently drops a name from
 * the namespace fails here.
 */
const EXPECTED_EXPORTS = [
    // src/constants/strings.ts (the only uppercase-named module, hence sorted first)
    'ALPHABET_STRING', 'EMPTY_STRING', 'NULL_STRING', 'NUMBERS_STRING', 'SPACE_STRING', 'UNDEFINED_STRING',
    // src/array, src/boolean, src/class, src/data
    'arrayCreate', 'arrayEach', 'arrayEachAsync', 'arrayEnsures', 'arrayRequeue', 'arrayShuffle', 'arrayWrapper',
    'booleanCases', 'booleanPartialFalse', 'booleanPartialTrue', 'booleanTrue',
    'classConstructor', 'classCreate',
    'dataClone', 'dataList',
    // src/function
    'functionChain', 'functionControl', 'functionCurry', 'functionDelay', 'functionOptions', 'functionPipe',
    'functionProxy', 'functionQueue', 'functionState',
    // src/conditions (ifFalse / ifThen / ifTrue sort between functionState and isBoolean)
    'ifFalse', 'ifThen', 'ifTrue',
    // src/is
    'isBoolean', 'isBooleanFalse', 'isBooleanTrue', 'isEmpty', 'isEmptyArray', 'isEmptyObject', 'isFunction',
    'isFunctionAsync', 'isInvalid', 'isNumber', 'isObject', 'isPromise', 'isString', 'isValid',
    // src/json, src/loop, src/number
    'jsonComplete', 'jsonStringify', 'jsonTable', 'jsonUpdate',
    'loopFor', 'loopForAsync', 'loopUntil', 'loopWhile',
    'numberEnsures',
    // src/object
    'objectAlias', 'objectCreate', 'objectEach', 'objectEachAsync', 'objectEnsures', 'objectExtract', 'objectFill',
    'objectFilter', 'objectFlatten', 'objectHasKey', 'objectMap', 'objectMapKeys', 'objectMerge', 'objectObserve',
    'objectPopulate', 'objectProxy', 'objectRegistry', 'objectResolve', 'objectScan', 'objectShuffle', 'objectSwitch',
    'objectTransform', 'objectTrigger', 'objectUnflatten', 'objectUpdate',
    // src/promise, src/script, src/string, src/task, src/to, src/type
    'promiseCreate',
    'scriptAsync', 'scriptChain', 'scriptPause', 'scriptResolve',
    'stringCapitalize', 'stringIncludes', 'stringReverse', 'stringSwitch', 'stringSwitchAsync',
    'taskCompletion', 'toString',
    'typeConstructor', 'typeName', 'typeSwitch', 'typeSwitchAsync',
];

/**
 * At least one representative public symbol from every one of the 17 function-exporting
 * submodules (constants are covered separately). Every entry must be reachable at root.
 */
const REPRESENTATIVE_FUNCTIONS = [
    'arrayCreate', 'arrayEach', 'arrayEnsures', 'arrayRequeue', 'arrayShuffle', 'arrayWrapper',
    'booleanCases', 'booleanPartialTrue', 'booleanPartialFalse', 'booleanTrue',
    'classConstructor', 'classCreate',
    'ifTrue', 'ifFalse', 'ifThen',
    'dataClone', 'dataList',
    'functionChain', 'functionControl', 'functionCurry', 'functionDelay', 'functionOptions', 'functionPipe',
    'functionProxy', 'functionQueue', 'functionState',
    'isBoolean', 'isBooleanTrue', 'isBooleanFalse', 'isEmpty', 'isEmptyArray', 'isEmptyObject', 'isFunction',
    'isFunctionAsync', 'isInvalid', 'isNumber', 'isObject', 'isPromise', 'isString', 'isValid',
    'jsonComplete', 'jsonStringify', 'jsonTable', 'jsonUpdate',
    'loopFor', 'loopForAsync', 'loopUntil', 'loopWhile',
    'numberEnsures',
    'objectAlias', 'objectCreate', 'objectEach', 'objectEachAsync', 'objectEnsures', 'objectExtract', 'objectFill',
    'objectFilter', 'objectFlatten', 'objectHasKey', 'objectMap', 'objectMapKeys', 'objectMerge', 'objectObserve',
    'objectPopulate', 'objectProxy', 'objectRegistry', 'objectResolve', 'objectScan', 'objectShuffle', 'objectSwitch',
    'objectTransform', 'objectTrigger', 'objectUnflatten', 'objectUpdate',
    'promiseCreate',
    'scriptAsync', 'scriptChain', 'scriptPause', 'scriptResolve',
    'stringCapitalize', 'stringIncludes', 'stringReverse', 'stringSwitch', 'stringSwitchAsync',
    'taskCompletion', 'toString',
    'typeConstructor', 'typeName', 'typeSwitch', 'typeSwitchAsync',
];

describe('root barrel (src/index.ts)', () => {
    test('publishes exactly the union of every submodule barrel runtime export', () => {
        expect(Object.keys(core).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every re-exported function is reachable as a live function', () => {
        // All 18 barrels re-export nothing but functions except ./constants, so the
        // representative list must resolve to 'function' for every name.
        expect(REPRESENTATIVE_FUNCTIONS.map((name) => [name, typeof (core as any)[name]]))
            .toStrictEqual(REPRESENTATIVE_FUNCTIONS.map((name) => [name, 'function']));
        // Every representative name must also be an OWN key of the namespace, so an
        // Object.prototype name (toString) cannot pass by prototype lookup alone.
        expect(REPRESENTATIVE_FUNCTIONS.filter((name) => !Object.keys(core).includes(name))).toStrictEqual([]);
    });

    test('the six documented constants are re-exported at root with exact values', () => {
        // REGRESSION: src/index.ts used to omit `export * from './constants'`, so
        // `import { EMPTY_STRING } from '@presource/core'` in scripts/clean-temp.ts and
        // scripts/sync-versions.ts silently resolved to `undefined`.
        expect({
            EMPTY_STRING: core.EMPTY_STRING,
            SPACE_STRING: core.SPACE_STRING,
            NUMBERS_STRING: core.NUMBERS_STRING,
            ALPHABET_STRING: core.ALPHABET_STRING,
            NULL_STRING: core.NULL_STRING,
            UNDEFINED_STRING: core.UNDEFINED_STRING,
        }).toStrictEqual({
            EMPTY_STRING: '',
            SPACE_STRING: ' ',
            NUMBERS_STRING: '0123456789',
            ALPHABET_STRING: 'abcdefghijklmnopqrstuvwxyz',
            NULL_STRING: 'null',
            UNDEFINED_STRING: 'undefined',
        });
    });

    test('the root constants are the same values the constants barrel publishes', () => {
        expect([core.EMPTY_STRING, core.SPACE_STRING, core.NUMBERS_STRING, core.ALPHABET_STRING, core.NULL_STRING, core.UNDEFINED_STRING])
            .toStrictEqual([EMPTY_STRING, SPACE_STRING, NUMBERS_STRING, ALPHABET_STRING, NULL_STRING, UNDEFINED_STRING]);
    });

    test('root re-exports are the same implementations as the deep modules (no shadowing)', () => {
        // 22 identity checks spanning all 18 submodules (constants included above).
        expect(core.arrayCreate).toBe(arrayCreate);
        expect(core.arrayEach).toBe(arrayEach);
        expect(core.arrayEnsures).toBe(arrayEnsures);
        expect(core.arrayRequeue).toBe(arrayRequeue);
        expect(core.arrayShuffle).toBe(arrayShuffle);
        expect(core.arrayWrapper).toBe(arrayWrapper);
        expect(core.booleanCases).toBe(booleanCases);
        expect(core.classConstructor).toBe(classConstructor);
        expect(core.ifTrue).toBe(ifTrue);
        expect(core.dataClone).toBe(dataClone);
        expect(core.functionChain).toBe(functionChain);
        expect(core.isString).toBe(isString);
        expect(core.jsonStringify).toBe(jsonStringify);
        expect(core.loopFor).toBe(loopFor);
        expect(core.numberEnsures).toBe(numberEnsures);
        expect(core.objectMerge).toBe(objectMerge);
        expect(core.promiseCreate).toBe(promiseCreate);
        expect(core.scriptPause).toBe(scriptPause);
        expect(core.stringReverse).toBe(stringReverse);
        expect(core.taskCompletion).toBe(taskCompletion);
        expect(core.toString).toBe(toString);
        expect(core.typeSwitch).toBe(typeSwitch);
    });

    test('functions reached through the root barrel actually execute (smoke)', () => {
        // Root consumers get working behaviour, not just callable identities.
        expect(core.arrayCreate(3)).toStrictEqual([undefined, undefined, undefined]);
        expect(core.arrayEnsures('x')).toStrictEqual(['x']);
        expect(core.isString('x')).toBe(true);
        expect(core.numberEnsures('42')).toBe(42);
        expect(core.objectMerge({ a: { b: 1 } }, { a: { c: 2 } })).toStrictEqual({ a: { b: 1, c: 2 } });
        expect(core.stringReverse('abc')).toBe('cba');
        expect(core.toString(123)).toBe('123');
        expect(core.typeName(1)).toBe('number');
    });

    test('the root barrel exposes no default export', () => {
        // No submodule declares `export default`, so `default` must not leak into the
        // namespace through the bundler's interop layer.
        expect(Object.keys(core).includes('default')).toBe(false);
        expect((core as any).default).toBeUndefined();
    });
});
