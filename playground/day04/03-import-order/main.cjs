// Day 4 · Puzzle 3 (CommonJS): set the env var first, then load the DB module.
// PREDICT both lines, then compare with main.mjs:
//   node playground/day04/03-import-order/main.cjs

process.env.DB_URL = 'postgres://localhost/shop'; // "load the config", like dotenv.config()
const { connect } = require('./db.cjs');
connect();
