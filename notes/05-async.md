# 05 · Async patterns ★ (Day 3)

> **The whole chapter in one line:**
> `await` pauses only **your function**, never the server. The real skill is choosing **one-by-one vs all-together**,
> and handling errors so that one failure can't crash the whole process.

Demos:
```bash
node playground/day03/01-sequential-vs-parallel.js
node playground/day03/02-early-rejection.js later
node playground/day03/02-early-rejection.js all
```

---

## 1. Three styles, same job 🍕

🧠 **Memory hook: ordering a pizza**

| Style           | Pizza version                                              | Errors go to                |
|-----------------|------------------------------------------------------------|-----------------------------|
| **Callback**    | "Call me on this number when it's ready"                   | `err`, the **1st** argument |
| **Promise**     | You get a **token**; collect the pizza later               | `.catch()`                  |
| **async/await** | You wait at the counter… but the shop keeps serving others | `try/catch`                 |

The same job in all three styles:
```js
fs.readFile(path, (err, data) => { ... });              // callback
fsp.readFile(path).then((data) => ...).catch(...);      // promise
const data = await fsp.readFile(path);                  // async/await (inside try/catch)
```

- **Error-first callback:** Node's old convention, `(err, result)`. `err` is `null` when all is fine.
- **Callback hell:** callbacks inside callbacks inside callbacks, a pyramid 🔺. It's hard to read and easy to forget an error.
  Promises flatten it into a chain.
- **Promise states:** `pending` → `fulfilled` ✅ or `rejected` ❌. Once settled, it **never changes**.
- **async/await** is just nicer syntax over promises. An `async` function **always returns a promise**.
- 🔑 `await` pauses **only this function**. The thread is free, and the event loop keeps serving other requests.
  (Day 2: code after `await` = a hidden `.then`.)

## 2. 🤔 Puzzle 1: one by one, all together, or… not waiting at all?

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));   // a fake 100 ms "DB call"

console.time('A');                                       // A: await one by one
await sleep(100);
await sleep(100);
await sleep(100);
console.timeEnd('A');

console.time('B');                                       // B: start all three, wait for all
await Promise.all([sleep(100), sleep(100), sleep(100)]);
console.timeEnd('B');

console.time('C');                                       // C: forEach with an async callback
[1, 2, 3].forEach(async (n) => {
  await sleep(100);
  console.log('C item', n);
});
console.timeEnd('C');

console.time('D');                                       // D: start first, await later
const p1 = sleep(100);
const p2 = sleep(100);
const p3 = sleep(100);
await p1;
await p2;
await p3;
console.timeEnd('D');
```
**Predict:** the time for A, B, C and D. And **where** do the `C item` lines print?

<details><summary>👀 Real output + why</summary>

```
A: 303.172ms
B: 101.26ms
C: 0.362ms
C item 1
C item 2
C item 3
D: 100.07ms
```
(3 runs: A ≈ 302–304 ms, B ≈ 101 ms, C ≈ 0.1–0.4 ms, D ≈ 100–102 ms.)

| Case | Time    | Why                                                                          |
|------|---------|------------------------------------------------------------------------------|
| A    | ~300 ms | Each `await` finishes **before the next one starts**: 100 + 100 + 100        |
| B    | ~100 ms | All 3 **started together**; `Promise.all` waits for the slowest              |
| C    | ~0 ms   | `forEach` **ignores** the promises from async callbacks. It doesn't wait! 😱 |
| D    | ~100 ms | 🔑 A promise **starts working when it's created**. `await` only *waits*      |

- The `C item` lines print **during D**. C's timers were already running and finished ~100 ms later.
- **Lesson from D:** the speed comes from **starting** the work together. `Promise.all` is the **safe** way
  to wait for all of them (puzzle 2 shows why "safe").
- **Fix for C:** `for (const n of items) await …` (one by one), or `await Promise.all(items.map(async (n) => …))` (together).
</details>

### Concurrency vs parallelism (interviewers love this pair)

- **Concurrency** = many tasks **in progress** at once; their waiting overlaps. That's B and D: 1 thread, 3 waits at the same time.
- **Parallelism** = many tasks **running** at the same instant on different CPU cores. Your JS code doesn't do that
  by itself; it needs `worker_threads` (Day 7).
- 🧠 *Ek waiter, teen tables ke orders = concurrency. Teen waiters = parallelism.*

### Which one when?

| Pattern                                 | Use when                                              |
|-----------------------------------------|-------------------------------------------------------|
| `for…of` + `await` (one by one)         | each step needs the last result, or you must go slow  |
| `Promise.all` (together)                | the tasks are independent, and there are only a few   |
| a **pool** with a limit (today's build) | many tasks (10,000 emails): together, max N at a time |

## 3. 🤔 Puzzle 2: start early, await later… and one of them FAILS

```js
try {
  const p1 = sleep(100);
  const p2 = fail(50);          // rejects at 50 ms, while we are still waiting for p1
  if (mode === 'later') {
    await p1;
    await p2;
  } else {
    await Promise.all([p1, p2]);
  }
} catch (err) {
  console.log(`[${mode}] caught:`, err.message);
}
console.log(`[${mode}] process still alive ✅`);
```
**Predict:** does the `try/catch` catch the error in **both** modes?

<details><summary>👀 Real output + why</summary>

```
$ node playground/day03/02-early-rejection.js later
Error: p2 failed                        ← 💥 the process CRASHED (exit code 1). The catch never ran!

$ node playground/day03/02-early-rejection.js all
[all] caught: p2 failed
[all] process still alive ✅
```
- In `later` mode, p2 fails at 50 ms. But nobody is listening to p2 yet, because we are still stuck on `await p1`.
- A rejected promise with **no handler** = an **unhandled rejection**. Since **Node 15**, that **crashes the process**.
  The `try/catch` never gets a chance.
- `Promise.all([p1, p2])` attaches a handler to **every** promise right away, so the failure is caught. ✅
- **Rule:** if you start several promises, wait for them with `Promise.all` / `Promise.allSettled`, not with one `await` after another.
- 🚀 **Real life:** in a Nest API, a crash kills **every user's** request until the process restarts. *Ek galti, sab down.*
</details>

---

*Next in this session: `Promise.all` / `allSettled` / `race` / `any` · what blocks the loop · the libuv thread pool ·
build: your own `promiseAll` and `promisePool(limit)`.*

## ⚠️ Interview traps (so far)

| They say…                                       | You say…                                                        |
|-------------------------------------------------|-----------------------------------------------------------------|
| "`await` blocks the thread."                    | No. It pauses **only this function**; the loop serves others    |
| "`forEach` waits for async callbacks."          | No! Use `for…of`, or `Promise.all(items.map(…))`                |
| "`Promise.all` runs them in parallel."          | They already run once **created**. `all` only waits             |
| "Awaiting started promises one by one is fine." | An early rejection is **unhandled** → the process crashes       |
| "Node is parallel because it's async."          | It's **concurrent** (waits overlap). Parallel CPU needs workers |
