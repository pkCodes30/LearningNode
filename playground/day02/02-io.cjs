// Day 2 · Puzzle 2: the same two timers, but scheduled INSIDE an I/O callback.
// PREDICT first, then run several times:
//   node playground/day02/02-io.cjs

const fs = require('node:fs');

fs.readFile(__filename, () => {
  // we are now in the POLL phase (an I/O callback)
  setTimeout(() => console.log('B: setTimeout 0'), 0);
  setImmediate(() => console.log('C: setImmediate'));
});
