// Day 4 · Puzzle 3, the fix: put the env loading in its own module and import it first.
//   node playground/day04/03-import-order/main-fixed.mjs

import './load-env.mjs';
import { connect } from './db.mjs';
connect();
