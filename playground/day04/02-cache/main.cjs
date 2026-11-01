// Day 4 · Puzzle 2: require the same file twice. How many times does it run? Is the state shared?
// PREDICT every line (including how many times "📦" prints). Then run:
//   node playground/day04/02-cache/main.cjs

const a = require('./counter.cjs');
const b = require('./counter.cjs');

a.increment();
a.increment();

console.log('a === b      :', a === b);
console.log('b.getCount() :', b.getCount());
console.log('b.count      :', b.count);

// Part 2: remove it from the cache, then require it again.
delete require.cache[require.resolve('./counter.cjs')];
const c = require('./counter.cjs');

console.log('c === a      :', c === a);
console.log('c.getCount() :', c.getCount());
