// Day 3 · Puzzle 3: the four combinators. Same 3 tasks, 4 different "wait" rules.
// PREDICT for each case: ✅ or ❌, with WHAT value, after HOW MANY ms? Then run:
//   node playground/day03/03-combinators.js

// Fake async tasks: `ok` passes with `value` after `ms`; `bad` fails with `message` after `ms`.
const ok = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const bad = (ms, message) => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

// Cases 2–5 use the same 3 tasks: A passes at 300 ms, B FAILS at 100 ms, C passes at 200 ms.
const mixed = () => [ok(300, 'A'), bad(100, 'B failed'), ok(200, 'C')];

await run('1. all (all pass)', () => Promise.all([ok(300, 'A'), ok(100, 'B'), ok(200, 'C')]));
await run('2. all', () => Promise.all(mixed()));
await run('3. allSettled', () => Promise.allSettled(mixed()));
await run('4. race', () => Promise.race(mixed()));
await run('5. any', () => Promise.any(mixed()));
await run('6. any (all fail)', () => Promise.any([bad(100, 'X failed'), bad(200, 'Y failed')]));

// ---- helpers (no need to read these) ----

// Runs one case, then prints how it ended and how long it took.
async function run(label, makePromise) {
  const start = performance.now();
  try {
    const value = await makePromise();
    console.log(`${label.padEnd(18)} ✅ ${show(value)}  ~${took(start)}`);
  } catch (err) {
    const errors = err.errors ? `, .errors = ${show(err.errors)}` : '';
    console.log(`${label.padEnd(18)} ❌ ${err.name}: ${err.message}${errors}  ~${took(start)}`);
  }
}

function took(start) {
  return `${Math.round(performance.now() - start)} ms`;
}

// Pretty-prints values; allSettled results go one per line.
function show(value) {
  if (Array.isArray(value)) {
    const items = value.map(show);
    return value.some((item) => item?.status)
      ? `[\n     ${items.join(',\n     ')}\n   ]`
      : `[${items.join(', ')}]`;
  }
  if (value instanceof Error) return `Error('${value.message}')`;
  if (typeof value === 'object') {
    const fields = Object.entries(value).map(([key, field]) => `${key}: ${show(field)}`);
    return `{ ${fields.join(', ')} }`;
  }
  return `'${value}'`;
}
