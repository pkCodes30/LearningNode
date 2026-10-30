// Day 3 · Puzzle 1: one by one, all together, or… not waiting at all?
// PREDICT the time for A, B, C and D, and WHERE the "C item" lines print. Then run:
//   node playground/day03/01-sequential-vs-parallel.js

// A fake "DB call" that takes `ms` milliseconds.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A: await one by one
console.time('A');
await sleep(100);
await sleep(100);
await sleep(100);
console.timeEnd('A');

// B: start all three, then wait for all of them
console.time('B');
await Promise.all([sleep(100), sleep(100), sleep(100)]);
console.timeEnd('B');

// C: forEach with an async callback
console.time('C');
[1, 2, 3].forEach(async (n) => {
  await sleep(100);
  console.log('C item', n);
});
console.timeEnd('C');

// D: start first, await later (no Promise.all)
console.time('D');
const p1 = sleep(100);
const p2 = sleep(100);
const p3 = sleep(100);
await p1;
await p2;
await p3;
console.timeEnd('D');
