// Day 3 · Real use of Promise.race: give any promise a time limit.
// Run both and compare WHEN the process exits:
//   node playground/day03/05-with-timeout.js          (forgets clearTimeout)
//   node playground/day03/05-with-timeout.js clear    (clears the timer)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clear = process.argv[2] === 'clear';

// Whichever settles first wins: the real work, or a timer that rejects after `ms`.
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  const raced = Promise.race([promise, timeout]);
  return clear ? raced.finally(() => clearTimeout(timer)) : raced;
}

const start = performance.now();
process.on('exit', () => console.log(`process exited at ~${Math.round(performance.now() - start)} ms`));

console.log('fast:', await withTimeout(sleep(100).then(() => 'done'), 2000)); // work wins at 100 ms
try {
  await withTimeout(sleep(500), 200); // timer wins at 200 ms
} catch (err) {
  console.log('slow:', err.message);
}
