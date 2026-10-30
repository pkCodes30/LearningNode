// Day 2 · Puzzle 3: async/await joins the party.
// PREDICT the order of the 7 numbers first, then run:
//   node playground/day02/03-async-await.cjs

console.log('1');

setTimeout(() => console.log('2'), 0);

(async () => {
  console.log('3');
  await null;
  console.log('4');
})();

Promise.resolve().then(() => console.log('5'));

process.nextTick(() => console.log('6'));

console.log('7');
