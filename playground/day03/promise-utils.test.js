// Day 3 · Build: tests for YOUR promiseAll and promisePool (Claude wrote these; no need to edit).
// Run all:        node --test playground/day03/promise-utils.test.js
// Run one group:  node --test --test-name-pattern=promiseAll playground/day03/promise-utils.test.js

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { promiseAll, promisePool } from './promise-utils.js';

const delay = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const fail = (ms, message) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

describe('promiseAll', { timeout: 2000 }, () => {
  it('gives the values in INPUT order, not finish order', async () => {
    const values = await promiseAll([delay(30, 'a'), delay(10, 'b'), delay(20, 'c')]);
    assert.deepEqual(values, ['a', 'b', 'c']);
  });

  it('accepts plain values too', async () => {
    assert.deepEqual(await promiseAll([1, delay(10, 2), 'three']), [1, 2, 'three']);
  });

  it('resolves [] for an empty array (and does not hang)', { timeout: 500 }, async () => {
    assert.deepEqual(await promiseAll([]), []);
  });

  it('fails fast: rejects as soon as ONE fails, without waiting for the rest', async () => {
    const start = performance.now();
    await assert.rejects(promiseAll([delay(300, 'slow'), fail(20, 'boom')]), { message: 'boom' });
    assert.ok(performance.now() - start < 150, 'took too long: did you await them one by one?');
  });

  it('rejects with the FIRST error in time, and the 2nd failure crashes nothing', async () => {
    await assert.rejects(promiseAll([fail(60, 'second'), fail(20, 'first')]), { message: 'first' });
    await delay(80); // let the 2nd failure happen while the test is still running
  });

  it('accepts any iterable, like a Set (not only arrays)', async () => {
    assert.deepEqual(await promiseAll(new Set([1, delay(10, 2)])), [1, 2]);
  });

  it('rejects with a TypeError when the input is not iterable (like the real one)', async () => {
    await assert.rejects(async () => promiseAll(undefined), TypeError);
  });
});

// Makes one task per duration. Each task logs when it starts and ends, and counts how many run at once.
function makeTasks(durations) {
  const log = [];
  let running = 0;
  let maxRunning = 0;
  const tasks = durations.map((ms, i) => async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    log.push(`start ${i}`);
    await delay(ms);
    log.push(`end ${i}`);
    running--;
    return `result ${i}`;
  });
  return { tasks, log, maxRunning: () => maxRunning };
}

describe('promisePool', { timeout: 3000 }, () => {
  it('gives the results in INPUT order', async () => {
    const { tasks } = makeTasks([30, 10, 20]);
    assert.deepEqual(await promisePool(tasks, 2), ['result 0', 'result 1', 'result 2']);
  });

  it('never runs more than `limit` at once, and does use all `limit` slots', async () => {
    const { tasks, maxRunning } = makeTasks([20, 20, 20, 20, 20, 20]);
    await promisePool(tasks, 2);
    assert.equal(maxRunning(), 2, `max tasks running at once was ${maxRunning()}, expected 2`);
  });

  it('refills a free slot at once (no waiting for a whole batch)', async () => {
    const { tasks, log } = makeTasks([200, 20, 20, 20]);
    await promisePool(tasks, 2);
    assert.ok(
      log.indexOf('start 2') < log.indexOf('end 0'),
      `task 2 waited for slow task 0 to finish. Order: ${log.join(', ')}`,
    );
  });

  it('works when limit is bigger than the number of tasks', async () => {
    const { tasks, maxRunning } = makeTasks([20, 20]);
    assert.deepEqual(await promisePool(tasks, 10), ['result 0', 'result 1']);
    assert.equal(maxRunning(), 2);
  });

  it('resolves [] when there are no tasks', { timeout: 500 }, async () => {
    assert.deepEqual(await promisePool([], 3), []);
  });

  it('rejects when a task fails', async () => {
    const tasks = [() => delay(20, 'ok'), () => fail(10, 'task failed'), () => delay(20, 'ok')];
    await assert.rejects(promisePool(tasks, 2), { message: 'task failed' });
  });

  it('rejects when a task throws synchronously (not async)', async () => {
    const tasks = [() => { throw new Error('sync boom'); }];
    await assert.rejects(async () => promisePool(tasks, 1), { message: 'sync boom' });
  });

  it('rejects with a RangeError when limit < 1 (instead of hanging forever)', { timeout: 500 }, async () => {
    await assert.rejects(async () => promisePool([async () => 'a'], 0), RangeError);
  });
});
