// Day 3 · Puzzle 5: the same password hash, sync vs async. Does the heartbeat keep beating?
// PREDICT: how many 💓 lines print WHILE hashing, in each mode? Then run:
//   node playground/day03/06-heartbeat.js sync
//   node playground/day03/06-heartbeat.js async

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(crypto.pbkdf2);
const mode = process.argv[2] === 'async' ? 'async' : 'sync';
const start = performance.now();
const at = () => `${Math.round(performance.now() - start)} ms`;

// The heartbeat stands in for other users' requests. It should beat every 100 ms.
const heartbeat = setInterval(() => console.log(`💓 beat at ${at()}`), 100);

console.log(`hashing a password (${mode})…`);
if (mode === 'sync') {
  crypto.pbkdf2Sync('my-password', 'salt', 4_000_000, 64, 'sha512'); // ~1 s of CPU work
} else {
  await pbkdf2('my-password', 'salt', 4_000_000, 64, 'sha512');
}
console.log(`hash done at ${at()}`);

setTimeout(() => clearInterval(heartbeat), 250); // a couple more beats, then stop
