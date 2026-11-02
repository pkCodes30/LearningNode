// Day 4 · Top-level await: the importer waits until config.mjs has finished. Run:
//   node playground/day04/06-tla-require/main.mjs

console.log('main: starts');
import { config } from './config.mjs';
console.log('main: got', config.dbUrl);
