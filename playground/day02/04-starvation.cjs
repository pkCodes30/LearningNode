// Day 2 · Puzzle 4: starvation. Can the VIP line block everyone else?
// PREDICT first: when does the timer fire in each mode, early or at the very end?
//   node playground/day02/04-starvation.cjs nextTick
//   node playground/day02/04-starvation.cjs immediate

const mode = process.argv[2] === 'immediate' ? 'immediate' : 'nextTick';
const schedule = mode === 'immediate' ? setImmediate : process.nextTick;

let count = 0;
setTimeout(() => console.log(`⏰ timer fired when count = ${count}`), 0);

function spin() {
  count++;
  if (count < 100_000) schedule(spin); // keep adding myself back to the line
  else console.log(`✅ ${mode} loop finished, count = ${count}`);
}
schedule(spin);
