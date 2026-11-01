// Day 3 · Puzzle 4: Promise.all failed… did the other tasks STOP?
// PREDICT the order of the printed lines (and whether "saved" lines print at all). Then run:
//   node playground/day03/04-no-cancel.js

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A fake "save to DB" that takes `ms` and logs when it finishes.
async function save(name, ms) {
  await sleep(ms);
  console.log(`${name} saved`);
}

// A fake payment call that fails after `ms`.
async function chargeCard(ms) {
  await sleep(ms);
  throw new Error('payment failed');
}

// One "place order" request: three steps started together.
try {
  await Promise.all([save('order', 300), chargeCard(100), save('invoice', 200)]);
  console.log('order placed');
} catch (err) {
  console.log('caught:', err.message);
}
console.log('request finished → sent 500 to the user');
