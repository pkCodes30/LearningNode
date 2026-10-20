// Day 1: blocking the event loop.
// Run: node playground/day01/blocking.js
// Output: "loop done" first, then "timer fired after ~2000 ms" (not 100 ms).

const start = Date.now();

setTimeout(() => {
  console.log(`timer fired after ${Date.now() - start} ms`);
}, 100);

// heavy CPU work: the waiter is busy cooking himself for 2 seconds
while (Date.now() - start < 2000) {}

console.log('loop done');
