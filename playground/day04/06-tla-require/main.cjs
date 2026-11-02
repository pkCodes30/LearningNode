// Day 4 · Can CommonJS require() an ES module? (New in Node 22+/24.) Run:
//   node playground/day04/06-tla-require/main.cjs

const { hello } = require('./plain.mjs');
console.log('require(plain.mjs) →', hello);

try {
  require('./config.mjs'); // this one has top-level await
} catch (err) {
  console.log('require(config.mjs) →', err.code);
}
