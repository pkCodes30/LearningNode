// Day 2 · Bonus: the SAME 4 lines as recall Q2, but this file is ESM (.mjs). Compare with the .cjs twin.
//   node playground/day02/06-esm-twist.cjs
//   node playground/day02/06-esm-twist.mjs
setTimeout(() => console.log('T'), 0);
Promise.resolve().then(() => console.log('P'));
process.nextTick(() => console.log('N'));
console.log('S');
