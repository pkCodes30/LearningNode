// Day 3 · Puzzle 6: 8 password hashes start at the SAME time, then one tiny file read.
// PREDICT: when does each hash finish? And the file read (alone it takes ~1 ms)? Then run it twice:
//   node playground/day03/07-thread-pool.js
//   UV_THREADPOOL_SIZE=8 node playground/day03/07-thread-pool.js

import crypto from 'node:crypto';
import fs from 'node:fs';

const start = performance.now();
const at = () => `${Math.round(performance.now() - start)} ms`;

console.log(`thread pool size: ${process.env.UV_THREADPOOL_SIZE ?? '4 (the default)'}`);

for (let i = 1; i <= 8; i++) {
  crypto.pbkdf2('my-password', 'salt', 1_000_000, 64, 'sha512', () => {
    console.log(`hash ${i} done at ${at()}`);
  });
}

fs.readFile(import.meta.filename, () => console.log(`📄 file read done at ${at()}`));
