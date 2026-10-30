// Day 2 · Puzzle 1: who prints first?
// (.cjs = CommonJS, the classic setup interview questions assume. ESM twist comes later!)
// PREDICT the order of the 6 lines BEFORE running:
//   node playground/day02/01-order.cjs

console.log('A: sync start');

setTimeout(() => console.log('B: setTimeout 0'), 0);

setImmediate(() => console.log('C: setImmediate'));

Promise.resolve().then(() => console.log('D: promise.then'));

process.nextTick(() => console.log('E: nextTick'));

console.log('F: sync end');
