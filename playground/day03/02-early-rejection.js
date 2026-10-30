// Day 3 · Puzzle 2: "start first, await later" vs Promise.all, when one promise FAILS early.
// PREDICT: does the try/catch catch the error in both modes? Then run:
//   node playground/day03/02-early-rejection.js later
//   node playground/day03/02-early-rejection.js all

const mode = process.argv[2] === 'all' ? 'all' : 'later';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('p2 failed')), ms));

try {
  const p1 = sleep(100);
  const p2 = fail(50); // fails while we are still waiting for p1
  if (mode === 'later') {
    await p1;
    await p2;
  } else {
    await Promise.all([p1, p2]);
  }
  console.log('all done');
} catch (err) {
  console.log(`[${mode}] caught:`, err.message);
}
console.log(`[${mode}] process still alive ✅`);
