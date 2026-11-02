// Day 4 · Puzzle 6: which versions does each range in package.json accept? Then run:
//   node playground/day04/07-semver.cjs
// (uses the `semver` package npm itself uses; it's already in node_modules)

const semver = require('semver');

const versions = ['1.2.3', '1.2.9', '1.3.0', '1.9.0', '2.0.0'];
for (const range of ['1.2.3', '~1.2.3', '^1.2.3']) {
  const ok = versions.filter((v) => semver.satisfies(v, range));
  console.log(`${range.padEnd(7)} accepts → ${ok.join(', ')}`);
}

const zeroVersions = ['0.2.3', '0.2.9', '0.3.0', '1.0.0'];
const ok = zeroVersions.filter((v) => semver.satisfies(v, '^0.2.3'));
console.log(`^0.2.3  accepts → ${ok.join(', ')}   (the 0.x trap!)`);
