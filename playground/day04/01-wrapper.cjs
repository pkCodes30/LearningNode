// Day 4 · Puzzle 1: what does a CommonJS file get "for free"?
// PREDICT each line. Then run this file and its ESM twin:
//   node playground/day04/01-wrapper.cjs
//   node playground/day04/01-wrapper.mjs

console.log('typeof require    :', typeof require);
console.log('typeof __dirname  :', typeof __dirname);
console.log('typeof arguments  :', typeof arguments);
console.log('arguments.length  :', typeof arguments === 'object' ? arguments.length : '-');
console.log('this === exports  :', this === module.exports);
