import * as taskModule from './index';
import { taskCompletion } from '@presource/core';

/**
 * src/task/index.ts barrel contract.
 *
 * Expected runtime surface, hand-derived from the single `export *` line in
 * src/task/index.ts (line 7): taskCompletion (src/task/completion.ts:28).
 * `normalizeThreadCount` (completion.ts:21) is a module-private helper and is NOT
 * exported, so it must not appear in the runtime key list.
 */
const EXPECTED_EXPORTS = ['taskCompletion'];

describe('task barrel (src/task/index.ts)', () => {
    test('publishes exactly the expected runtime export names', () => {
        expect(Object.keys(taskModule).sort()).toStrictEqual(EXPECTED_EXPORTS);
    });

    test('every published export is a live function', () => {
        expect(Object.fromEntries(Object.entries(taskModule).map(([name, value]) => [name, typeof value])))
            .toStrictEqual(Object.fromEntries(EXPECTED_EXPORTS.map((name) => [name, 'function'])));
    });

    test('the barrel binding is the same implementation the root barrel exposes', () => {
        expect(taskModule.taskCompletion).toBe(taskCompletion);
    });

    test('the re-exported taskCompletion returns exactly { add, completion } (completion.ts:28-104)', () => {
        const runner = taskModule.taskCompletion(2);
        expect(Object.keys(runner).sort()).toStrictEqual(['add', 'completion']);
        expect(typeof runner.add).toBe('function');
        expect(typeof runner.completion).toBe('function');
        // threadCount has a default, so Function#length excludes it
        expect(taskModule.taskCompletion.length).toBe(0);
    });

    test('the re-exported runner drains queued tasks in order and resolves completion', async () => {
        const order: number[] = [];
        const { add, completion } = taskModule.taskCompletion(1);
        add(async () => { order.push(1); });
        add(async () => { order.push(2); });
        await completion();
        expect(order).toStrictEqual([1, 2]);
    });

    test('a non-positive threadCount is clamped to 1 so completion cannot deadlock', async () => {
        // completion.ts:21-25 clamps 0 / NaN / negative values; without it the dequeue
        // loop would never start a task and completion() would hang forever.
        const ran: string[] = [];
        const { add, completion } = taskModule.taskCompletion(0);
        add(async () => { ran.push('done'); });
        await completion();
        expect(ran).toStrictEqual(['done']);
    });
});
