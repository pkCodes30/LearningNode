// A tiny CommonJS module with some state.
console.log('📦 counter.cjs is running');

let count = 0;

module.exports = {
  count,
  increment() {
    count++;
  },
  getCount() {
    return count;
  },
};
