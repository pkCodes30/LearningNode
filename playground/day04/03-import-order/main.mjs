// Day 4 · Puzzle 3 (ESM): the SAME code with import instead of require.
// PREDICT both lines. Then run:
//   node playground/day04/03-import-order/main.mjs

process.env.DB_URL = 'postgres://localhost/shop'; // "load the config", like dotenv.config()
import { connect } from './db.mjs';
connect();
