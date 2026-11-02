// Day 4 · Puzzle 4: ESM imports are "live". PREDICT both lines. Then run:
//   node playground/day04/04-live-bindings/main.mjs

import { count, increment } from './counter.mjs';

increment();
increment();
console.log('count =', count);

try {
  count = 10; // can the importer change it?
} catch (err) {
  console.log(`${err.name}: ${err.message}`);
}
