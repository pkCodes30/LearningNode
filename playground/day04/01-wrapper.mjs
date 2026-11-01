// Day 4 · Puzzle 1 (ESM twin): the same questions in an ES module.
//   node playground/day04/01-wrapper.mjs

console.log('typeof require    :', typeof require);
console.log('typeof __dirname  :', typeof __dirname);
console.log('typeof arguments  :', typeof arguments);
console.log('this              :', this);
console.log('import.meta.dirname:', import.meta.dirname); // the ESM way to get the folder
