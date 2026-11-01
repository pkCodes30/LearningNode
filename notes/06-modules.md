# 06 · Modules: CommonJS vs ESM (Day 4)

> **The whole chapter in one line:**
> A module is a file with its own private scope. CommonJS (`require`) wraps your file in a function and runs it
> **once**; ESM (`import`) is the modern JS standard, and it's what this repo uses.

Demos:
```bash
node playground/day04/01-wrapper.cjs
node playground/day04/01-wrapper.mjs
node playground/day04/02-cache/main.cjs
```

---

## 1. Two module systems 📦

|                       | CommonJS (CJS)                    | ES Modules (ESM)                      |
|-----------------------|-----------------------------------|---------------------------------------|
| Syntax                | `require()` / `module.exports`    | `import` / `export`                   |
| Born                  | 2009, Node's original             | 2015, the JS standard                 |
| Loading               | **sync**, at the `require` line   | all imports load **before** your code |
| Top-level `await`     | ❌                                | ✅                                    |
| File is this type if… | `.cjs`, or `.js` with no `"type"` | `.mjs`, or `.js` + `"type": "module"` |

- For a `.js` file, Node checks the nearest `package.json`. This repo has `"type": "module"`, so **every `.js` here is ESM**
  (remember the Day 2 ESM twist).
- 🧠 **Memory hook:** `require` = **ordering at the counter**: you ask, you wait, you get it, right at that line.
  `import` = **the kitchen is stocked before the restaurant opens**: every import is ready before your first line runs.

## 2. 🤔 Puzzle 1: what does a CommonJS file get "for free"?

```js
// 01-wrapper.cjs
console.log('typeof require    :', typeof require);
console.log('typeof __dirname  :', typeof __dirname);
console.log('typeof arguments  :', typeof arguments);
console.log('arguments.length  :', typeof arguments === 'object' ? arguments.length : '-');
console.log('this === exports  :', this === module.exports);
```
**Predict** every line. Then predict the same questions in an `.mjs` file (`this` instead of the last line).

<details><summary>👀 Real output + why</summary>

```
$ node playground/day04/01-wrapper.cjs
typeof require    : function
typeof __dirname  : string
typeof arguments  : object
arguments.length  : 5
this === exports  : true

$ node playground/day04/01-wrapper.mjs
typeof require    : undefined
typeof __dirname  : undefined
typeof arguments  : undefined
this              : undefined
import.meta.dirname: /Users/ai/Desktop/LearningNode/playground/day04
```

**Why:** Node wraps every CommonJS file in a function before running it. Real output of `require('node:module').wrapper`:
```
[
  '(function (exports, require, module, __filename, __dirname) { ',
  '\n});'
]
```
So your file really runs like this:
```js
(function (exports, require, module, __filename, __dirname) {
  // ...your file's code...
});
```
- `require`, `module`, `__dirname` are **function parameters**, not globals. That's why `arguments.length` = **5**.
- Node calls the wrapper with `this` = `module.exports`, so `this === exports` is `true`.
- A top-level `const x` in your file is a **local variable** of that function. That's why modules don't leak
  into each other (*har file ka apna private kamra*).
- **ESM has no wrapper.** No `require`, no `__dirname`, and `this` is `undefined`.
  Use `import`, plus `import.meta.dirname` / `import.meta.filename` instead.
</details>

## 3. 🤔 Puzzle 2: `require` the same file twice

```js
// counter.cjs
console.log('📦 counter.cjs is running');
let count = 0;
module.exports = {
  count,
  increment() { count++; },
  getCount() { return count; },
};

// main.cjs
const a = require('./counter.cjs');
const b = require('./counter.cjs');
a.increment();
a.increment();
console.log('a === b      :', a === b);
console.log('b.getCount() :', b.getCount());
console.log('b.count      :', b.count);

delete require.cache[require.resolve('./counter.cjs')];   // part 2: clear the cache…
const c = require('./counter.cjs');                         // …and require it again
console.log('c === a      :', c === a);
console.log('c.getCount() :', c.getCount());
```
**Predict** every line. How many times does `📦` print?

<details><summary>👀 Real output + why</summary>

```
📦 counter.cjs is running
a === b      : true
b.getCount() : 2
b.count      : 0
📦 counter.cjs is running
c === a      : false
c.getCount() : 0
```

| Line                 | Why                                                                |
|----------------------|--------------------------------------------------------------------|
| `📦` once at first   | the 1st `require` runs the file and **caches** `module.exports`    |
| `a === b` → true     | the 2nd `require` returns the **same cached object**               |
| `getCount()` → 2     | the function reads the **variable** `count`, which is now 2        |
| `b.count` → **0** 😱 | `{ count }` **copied** the number 0 into the object at export time |
| `📦` again           | we deleted the cache entry, so `require` ran the file again        |
| `c === a` → false    | a brand-new module object, with fresh state (0)                    |

- The cache key is the file's **full resolved path** (that's what `require.resolve` gives).
- 🚀 **Real life:** modules are **singletons**. A DB pool created in `db.js` is shared by every file that requires it.
- Deleting from `require.cache` is a trick for tests or hot reload, not for app code.
  ESM caches modules too, but there you can't delete them.
- The `b.count` copy trap is exactly what ESM fixes with **live bindings** (next chunk).
</details>

🎤 **Ready to speak: "What happens when you `require()` a file?"**
> "Node resolves the full path and checks `require.cache`. If the module is already there, it returns the cached
> `module.exports`. If not, it reads the file, wraps it in a function with `exports`, `require`, `module`,
> `__filename` and `__dirname`, runs it once, synchronously, caches `module.exports` and returns it.
> So a module is effectively a singleton: the second `require` gets the same object, and the file doesn't run again."

---

*Next in this session: ESM details (import hoisting, live bindings, top-level `await`, why imports here end in `.js`,
`require()` of ESM in Node 24) · package.json, semver `^` vs `~`, lockfiles · `process`, env, exit codes, signals.*

## ⚠️ Interview traps (so far)

| They say…                                     | You say…                                     |
|-----------------------------------------------|----------------------------------------------|
| "`__dirname` is a global."                    | A wrapper **parameter**. ESM doesn't have it |
| "Requiring a file twice runs it twice."       | It runs **once**; after that it's cached     |
| "`module.exports = { count }` stays in sync." | It's a **copy** of the value at export time  |
| "`this` at the top of a module is `global`."  | CJS: `module.exports`. ESM: `undefined`      |
