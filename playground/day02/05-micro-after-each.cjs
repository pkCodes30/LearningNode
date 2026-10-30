// Day 2 · Puzzle 5: are microtasks drained after each PHASE, or after each CALLBACK?
//   node playground/day02/05-micro-after-each.cjs

setTimeout(() => {
  console.log('timeout 1');
  Promise.resolve().then(() => console.log('  promise from timeout 1'));
}, 0);

setTimeout(() => {
  console.log('timeout 2');
  Promise.resolve().then(() => console.log('  promise from timeout 2'));
}, 0);
