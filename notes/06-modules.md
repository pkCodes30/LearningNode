# 06 · Modules: CommonJS vs ESM (Day 4)

> **The whole chapter in one line:**
> A module is a file with its own private scope. CommonJS (`require`) wraps your file in a function and runs it
> **once**; ESM (`import`) is the modern JS standard, and it's what this repo uses.

Demos:
```bash
node playground/day04/01-wrapper.cjs
node playground/day04/01-wrapper.mjs
node playground/day04/02-cache/main.cjs
node playground/day04/03-import-order/main.cjs        # then main.mjs, then main-fixed.mjs
node playground/day04/04-live-bindings/main.mjs
node playground/day04/05-extensions/main.js            # crashes on purpose
node playground/day04/06-tla-require/main.mjs         # then main.cjs
node playground/day04/07-semver.cjs
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

🔁 **Recall (11-01): the two whys.** Try first, then open.
1. Why does a `.cjs` file have `arguments.length === 5`, though you never wrote a function?
2. Why is `b.count` 0 while `b.getCount()` is 2?

<details><summary>✅ Answers</summary>

1. Node **wraps** the file in `function (exports, require, module, __filename, __dirname) { … }` and calls it
   with those 5 arguments. The top level of your file is really the **inside** of that function.
2. `{ count }` **copies** the value 0 into the object when the file runs. `increment()` changes the **variable**
   `count` (the closure), not the object's property. `getCount()` reads the variable → 2; `b.count` reads the old
   copy → 0. With ESM's `export let count`, you'd see the new value (a **live binding**, next chunk).

*Your predictions (11-01) were all right, but the whys were skipped, so they're written here.*
</details>

🎤 **Ready to speak: "What happens when you `require()` a file?"**
> "Node resolves the full path and checks `require.cache`. If the module is already there, it returns the cached
> `module.exports`. If not, it reads the file, wraps it in a function with `exports`, `require`, `module`,
> `__filename` and `__dirname`, runs it once, synchronously, caches `module.exports` and returns it.
> So a module is effectively a singleton: the second `require` gets the same object, and the file doesn't run again."

## 4. 🤔 Puzzle 3: set the env var, *then* load the DB module

```js
// db.mjs (db.cjs is the same with module.exports): reads the env the moment it runs
const url = process.env.DB_URL;
console.log('db loaded, url =', url);
export const connect = () => console.log('connecting to', url);

// main.cjs                                         // main.mjs
process.env.DB_URL = 'postgres://localhost/shop';   process.env.DB_URL = 'postgres://localhost/shop';
const { connect } = require('./db.cjs');            import { connect } from './db.mjs';
connect();                                          connect();
```
**Predict** both lines for `main.cjs`, then for `main.mjs`.

<details><summary>👀 Real output + why</summary>

```
$ node playground/day04/03-import-order/main.cjs
db loaded, url = postgres://localhost/shop
connecting to postgres://localhost/shop

$ node playground/day04/03-import-order/main.mjs
db loaded, url = undefined          ← 😱 db.mjs ran BEFORE line 1 of main.mjs
connecting to undefined
```
- **CJS:** `require` is a normal function call, so the module loads **at that line**, after the env var is set.
- **ESM** loads in 3 steps: **parse** every file and find all the imports → **link** them →
  **evaluate**, dependencies first. Your file's body runs only after **all** its imports have run.
  So `import` lines are effectively **hoisted** to the top, wherever you write them.
- **The fix:** put the env loading in its own module, and import it **first**. Imports run in order:
  ```js
  import './load-env.mjs';            // sets process.env.DB_URL
  import { connect } from './db.mjs';
  ```
  ```
  $ node playground/day04/03-import-order/main-fixed.mjs
  db loaded, url = postgres://localhost/shop
  connecting to postgres://localhost/shop
  ```
- 🚀 **Real file:** that's exactly why `prisma7.config.ts` starts with `import "dotenv/config";`. That line loads
  `.env` before any other import runs. `import dotenv from 'dotenv'; dotenv.config();` written below other imports
  would be too late for them.
- Even better: don't read env vars at **load time**. Read them when you need them (Nest's `ConfigService` does this).
</details>

## 5. 🤔 Puzzle 4: ESM imports are *live*

```js
// counter.mjs
export let count = 0;
export function increment() { count++; }

// main.mjs
import { count, increment } from './counter.mjs';
increment();
increment();
console.log('count =', count);
count = 10;          // can the importer change it?
```
**Predict** both lines. Compare with the CJS counter (`b.count` was 0).

<details><summary>👀 Real output + why</summary>

```
count = 2
TypeError: Assignment to constant variable.
```
- An ESM import is a **live binding**: a view of the exporter's **variable**, not a copy. So you see 2.
  (CJS `{ count }` copied the value 0 into an object, which never changed.)
- The view is **read-only**: only the module that owns `count` can change it (through `increment()`).
- 🧠 **Memory hook:** CJS export = a **photo** 📸 (a copy from that moment).
  ESM import = **live CCTV** 📹 (always current, but you can only watch).
</details>

### CJS vs ESM: the full picture

|                        | CommonJS                         | ESM                                   |
|------------------------|----------------------------------|---------------------------------------|
| Exports                | `module.exports` (values copied) | **live**, read-only bindings          |
| Loading                | sync, **at the `require` line**  | parse → link → run; **imports first** |
| `require`, `__dirname` | ✅ (wrapper params)              | ❌ use `import.meta.dirname`          |
| Top-level `await`      | ❌                               | ✅                                    |
| Tree-shaking           | ❌ hard (dynamic `require`)      | ✅ (static imports)                   |

- **Tree-shaking** = a bundler drops exports nobody imports. That's only possible when imports are static.

🎤 **Ready to speak: "CommonJS vs ESM?"**
> "CommonJS is Node's original system: `require` and `module.exports`. `require` is a normal synchronous call,
> so a module loads right at that line, and you get its exports object, with values copied at export time.
> ESM is the JS standard: `import` and `export`. Imports are static, so Node parses the whole graph first and
> runs every imported module before my file's body. That's why import order matters, for example
> `import 'dotenv/config'` must come first. ESM exports are live, read-only bindings, not copies. ESM also has
> top-level `await` and allows tree-shaking. CommonJS gets `require` and `__dirname` from the module wrapper;
> in ESM I use `import.meta.dirname`. Our project is ESM because `package.json` says `"type": "module"`."

## 6. Three ESM facts that bite in real projects

### 6a. 🤔 Puzzle 5: an import without `.js`

```js
// helper.js (ESM, because of "type": "module")
export const hi = () => 'hi from helper';

// main.js
import { hi } from './helper';      // no ".js"
console.log(hi());
```
**Predict:** does Node find `./helper.js`?

<details><summary>👀 Real output + why</summary>

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/playground/day04/05-extensions/helper'
imported from …/playground/day04/05-extensions/main.js
```
- CJS `require('./helper')` **guesses**: it tries `helper.js`, `helper.json`, `helper/index.js`…
- ESM **never guesses**. The path must name the exact file, like a URL in a browser.
- **Why every import in `src/` ends in `.js`** even though the files are `.ts`: TypeScript compiles
  `app.module.ts` → `dist/app.module.js`, but it does **not** rewrite import paths. With `"module": "nodenext"`
  in `tsconfig.json`, you write the name the file will have **at runtime**:
  `import { AppModule } from './app.module.js';` (`src/main.ts`, line 3). TS knows `.js` means the `.ts` source.
</details>

### 6b. Top-level `await` (ESM only)

```js
// config.mjs
console.log('config: loading…');
await new Promise((resolve) => setTimeout(resolve, 100));   // pretend: fetch secrets
export const config = { dbUrl: 'postgres://localhost/shop' };
console.log('config: ready');

// main.mjs
console.log('main: starts');
import { config } from './config.mjs';
console.log('main: got', config.dbUrl);
```
Real output (`node playground/day04/06-tla-require/main.mjs`):
```
config: loading…
config: ready
main: starts
main: got postgres://localhost/shop
```
- `await` at the top of a module works in ESM only. Every module that imports it **waits** until it's done.
- `main: starts` comes third: imports run first (section 4), and this import also had to finish its `await`.
- Use: load config or secrets before the app starts. ⚠️ A slow top-level `await` delays everything that imports it.

### 6c. Can CommonJS `require()` an ES module?

```js
// main.cjs
const { hello } = require('./plain.mjs');   // ESM without top-level await
require('./config.mjs');                     // ESM WITH top-level await
```
Real output (`node playground/day04/06-tla-require/main.cjs`, Node 24, no warning):
```
require(plain.mjs) → hello from an ES module
require(config.mjs) → ERR_REQUIRE_ASYNC_MODULE
```
- **Old answer (Node ≤ 20):** no. Use `await import('./x.mjs')`; dynamic `import()` works in CJS too.
- **New answer (Node 22.12+, including our 24):** yes, `require()` can load ESM, **unless** that module uses
  top-level `await`. `require` is synchronous, so it can't wait.
- The other direction always worked: ESM can `import` a CJS file (you get `module.exports` as the default export).

## 7. package.json, semver and the lockfile 📦

**Semver** = `MAJOR.MINOR.PATCH`, e.g. `12.0.1`.

| Part  | Bump it when…                 | Example       |
|-------|-------------------------------|---------------|
| MAJOR | a **breaking** change         | 1.9.0 → 2.0.0 |
| MINOR | a new feature, nothing breaks | 1.2.9 → 1.3.0 |
| PATCH | a bug fix only                | 1.2.3 → 1.2.4 |

### 🤔 Puzzle 6: which versions does each range accept?

Versions: `1.2.3`, `1.2.9`, `1.3.0`, `1.9.0`, `2.0.0`. Ranges: `1.2.3`, `~1.2.3`, `^1.2.3`.
Bonus: which of `0.2.3`, `0.2.9`, `0.3.0`, `1.0.0` does `^0.2.3` accept?

<details><summary>👀 Real output + why</summary>

```
$ node playground/day04/07-semver.cjs
1.2.3   accepts → 1.2.3
~1.2.3  accepts → 1.2.3, 1.2.9
^1.2.3  accepts → 1.2.3, 1.2.9, 1.3.0, 1.9.0
^0.2.3  accepts → 0.2.3, 0.2.9   (the 0.x trap!)
```
- **`~` (tilde) = patch updates only** (same MAJOR.MINOR). 🧠 *`~` is a small wave: chhote updates.*
- **`^` (caret) = minor + patch** (same MAJOR). 🧠 *`^` points up: anything up to the next major.*
- **The 0.x trap:** below 1.0.0, any minor bump may break things, so `^0.2.3` also locks the minor (`< 0.3.0`).
- This repo: `"@nestjs/core": "^12.0.1"` → any `12.x` from `12.0.1` up, never `13`.
</details>

### package.json fields you must know (this repo)

| Field             | Meaning                         | Here                                       |
|-------------------|---------------------------------|--------------------------------------------|
| `dependencies`    | needed when the app **runs**    | `@nestjs/core`, `@prisma/client`, `dotenv` |
| `devDependencies` | only to **build / test / lint** | `typescript`, `vitest`, `oxlint`           |
| `scripts`         | `npm run <name>` shortcuts      | `start:dev`, `test`, `lint`                |
| `engines`         | which Node it needs             | `"node": ">=24"`                           |
| `type`            | `"module"` → `.js` = ESM        | `"module"`                                 |

### The lockfile 🔒

- `package.json` stores **ranges** (`^12.0.1`). `package-lock.json` stores the **exact** version of every package
  in the tree, including dependencies of dependencies: **541** packages here.
- **Why commit it:** you, CI, Docker and prod all install the **same** versions. Without it, a patch released
  tomorrow can change what gets installed. That causes "works on my machine" bugs, or lets a bad release sneak in.
- `npm install` uses the lockfile but **may update** it (when you add a package or `package.json` changed).
- `npm ci` deletes `node_modules` and installs **exactly** the lockfile. It **fails** if `package.json` and the
  lockfile disagree, and it never writes the lockfile. Use it in CI and in Dockerfiles (Days 13 and 27).

🎤 **Ready to speak: "`^` vs `~`, and why commit the lockfile?"**
> "Versions are semver: major, minor, patch. Caret allows minor and patch updates within the same major,
> so `^1.2.3` can install `1.9.0` but never `2.0.0`. Tilde allows only patches, so `~1.2.3` stays on `1.2.x`.
> Below 1.0, caret also locks the minor. `package.json` only has these ranges, so two installs on different
> days can get different versions. The lockfile pins the exact version of every package in the tree, so I commit
> it, and in CI and Docker I use `npm ci`, which installs exactly the lockfile and fails if it's out of sync."

## 8. 📝 Revision Q&A: Day 4 interview questions

**Say your answer out loud first**, then open the box.

**Q1. ★ CommonJS vs ESM: give the main differences.**
<details><summary>✅ Answer</summary>

1. **Syntax:** `require` / `module.exports` vs `import` / `export`.
2. **Loading:** `require` is a normal sync call, so the module loads **at that line**. ESM parses the whole import
   graph first and runs every import **before** your file's body (imports are hoisted).
3. **Exports:** CJS gives you the `module.exports` object (a **copy** of values like `count`). ESM gives
   **live, read-only bindings** (you see `count` change; you can't assign to it).
4. **Extras:** ESM has top-level `await` and allows tree-shaking. CJS has `require`, `module`, `__dirname` from the
   **module wrapper**; ESM uses `import.meta.dirname`.
5. **Which one a `.js` file is:** `"type": "module"` in `package.json` → ESM (this repo); `.cjs` / `.mjs` force it.

The spoken version is in section 5.
</details>

**Q2. What happens when you `require()` a file? Does it run twice if required twice?**
<details><summary>✅ Answer</summary>

Node resolves the full path and checks `require.cache`. If it's there, it returns the cached `module.exports`.
If not, it reads the file, wraps it in `function (exports, require, module, __filename, __dirname)`, runs it
**once**, synchronously, then caches and returns `module.exports`. So a second `require` doesn't run the file again;
it gets the **same object** (modules act like singletons, e.g. one shared DB pool).
</details>

**Q3. ★ `^1.2.3` vs `~1.2.3`? Which one can install `1.3.0`? What does `^0.2.3` allow?**
<details><summary>✅ Answer</summary>

Semver is `MAJOR.MINOR.PATCH`. `~1.2.3` allows **patch** updates only: `1.2.x` from `1.2.3` up. `^1.2.3` allows
**minor + patch**: anything `1.x` from `1.2.3` up, never `2.0.0`. So only `^` can install `1.3.0`.
**0.x trap:** below 1.0, `^` also locks the minor, so `^0.2.3` allows `0.2.x` only, not `0.3.0`
(real output in puzzle 6).
</details>

**Q4. ★ Why commit `package-lock.json`? `npm ci` vs `npm install`?**
<details><summary>✅ Answer</summary>

`package.json` only has **ranges**, so two installs on different days can get different versions. The lockfile pins
the **exact** version of every package in the tree (541 here), so my laptop, CI, Docker and prod all get the same
code: no "works on my machine" bugs, and a bad new release can't sneak in. `npm install` uses the lockfile but **may
update** it. `npm ci` deletes `node_modules`, installs **exactly** the lockfile, **fails** if it's out of sync with
`package.json`, and never writes it. That's why CI and Dockerfiles use `npm ci`.
</details>

**Q5. `dependencies` vs `devDependencies`: why does it matter?**
<details><summary>✅ Answer</summary>

`dependencies` are needed when the app **runs** (`@nestjs/core`, `@prisma/client`). `devDependencies` are only for
**building, testing and linting** (`typescript`, `vitest`, `oxlint`). In production you install with
`npm ci --omit=dev`, so a wrong choice either breaks prod (a runtime package in dev) or makes the Docker image bigger
and adds attack surface (a dev tool in dependencies).
</details>

**Q6. Why does every import in `src/` end in `.js`, though the files are `.ts`?**
<details><summary>✅ Answer</summary>

ESM **never guesses** file extensions: `import './helper'` fails with `ERR_MODULE_NOT_FOUND` (puzzle 5).
TypeScript compiles `app.module.ts` → `app.module.js` but doesn't rewrite import paths. So with
`"module": "nodenext"` you write the name the file has **at runtime**: `'./app.module.js'` (`src/main.ts`, line 3).
</details>

**Q7. Why must `import "dotenv/config"` be the first import (`prisma7.config.ts`)?**
<details><summary>✅ Answer</summary>

ESM runs all imported modules **before** the body of your file, in import order. If a module reads `process.env` while
it loads (for example to build a DB URL), the env must already be loaded. `import "dotenv/config"` as the **first**
import loads `.env` before the others run. `dotenv.config()` written in the body would be too late
(puzzle 3: `url = undefined`). Even better: read env vars when you need them, not at load time.
</details>

**Q8. Can CommonJS `require()` an ES module? Can ESM `import` CommonJS?**
<details><summary>✅ Answer</summary>

ESM → CJS: always yes; `module.exports` becomes the default import. CJS → ESM: in old Node, no (use dynamic
`await import()`). Since Node 22.12 (and on our Node 24), `require()` **can** load an ES module, **unless** it uses
top-level `await`. Then you get `ERR_REQUIRE_ASYNC_MODULE`, because `require` is synchronous and can't wait.
</details>

---

*Day 4 done ✅. `process`, env, exit codes and signals move to **Day 7** (errors & process), the same topic family.
Days 5–7 now come **after** the Nest week (the learner's choice on 11-01).
The Day 4 build ("the same module in CJS and ESM; inspect `require.cache`") is covered by puzzles 2 and 4.*

## ⚠️ Interview traps (so far)

| They say…                                     | You say…                                           |
|-----------------------------------------------|----------------------------------------------------|
| "`__dirname` is a global."                    | A wrapper **parameter**. ESM doesn't have it       |
| "Requiring a file twice runs it twice."       | It runs **once**; after that it's cached           |
| "`module.exports = { count }` stays in sync." | It's a **copy** of the value at export time        |
| "`this` at the top of a module is `global`."  | CJS: `module.exports`. ESM: `undefined`            |
| "`import` runs where you write it."           | Imports are **hoisted**: they run before your code |
| "An imported `let` is a copy."                | It's a **live**, read-only binding                 |
| "You can reassign an imported variable."      | `TypeError`: only the owner module can             |
| "`^1.2.3` can install 2.0.0."                 | No: same major only. `~` = patch only              |
| "`^0.2.3` allows 0.3.0."                      | No: below 1.0, `^` locks the minor too             |
| "`npm install` ignores the lockfile."         | It uses it, but may update it. `npm ci` never does |
| "ESM finds `./helper` like `require` does."   | ESM never guesses the extension                    |
| "CJS can never `require()` ESM."              | Node 22.12+ can, unless it uses top-level `await`  |
