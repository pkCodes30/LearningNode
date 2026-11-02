# 05 · Async patterns ★ (Day 3)

> **The whole chapter in one line:**
> `await` pauses only **your function**, never the server. The real skill is choosing **one-by-one vs all-together**,
> and handling errors so that one failure can't crash the whole process.

Demos:
```bash
node playground/day03/01-sequential-vs-parallel.js
node playground/day03/02-early-rejection.js later
node playground/day03/02-early-rejection.js all
node playground/day03/03-combinators.js
node playground/day03/04-no-cancel.js
node playground/day03/05-with-timeout.js          # then again with: clear
node playground/day03/06-heartbeat.js sync        # then: async
node playground/day03/07-thread-pool.js           # then: UV_THREADPOOL_SIZE=8 node …
```

---

## 1. Three styles, same job 🍕

🧠 **Memory hook: ordering a pizza**

| Style           | Pizza version                                   | Errors go to           |
|-----------------|-------------------------------------------------|------------------------|
| **Callback**    | "Call me when it's ready"                       | `err`, the **1st** arg |
| **Promise**     | You get a **token**; collect the pizza later    | `.catch()`             |
| **async/await** | You wait at the counter; the shop serves others | `try/catch`            |

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

## 4. The four combinators: `all`, `allSettled`, `race`, `any` 🤝

🧠 **Memory hook: you ask 3 friends for udhaar (a loan) on WhatsApp**

| Combinator   | Friends version                                       |
|--------------|-------------------------------------------------------|
| `all`        | You need **all 3** to say yes. One "no" = plan fails  |
| `allSettled` | You just want **everyone's reply**, yes or no         |
| `race`       | You act on the **first reply**, even if it's a "no"   |
| `any`        | The **first "yes"** wins. Fail only if **all** say no |

Two words first:
- **Settled** = finished, pass *ya* fail (fulfilled or rejected).
- **Fail-fast** = stop waiting at the **first** failure.

| Combinator   | ✅ Resolves with                  | ❌ Rejects when                 |
|--------------|-----------------------------------|---------------------------------|
| `all`        | every value, in **input** order   | the **first** one fails         |
| `allSettled` | one `{status, value/reason}` each | **never**                       |
| `race`       | the first settled value           | the first settled one failed    |
| `any`        | the first **success**             | **all** fail → `AggregateError` |

### 🤔 Puzzle 3: same 3 tasks, 4 different rules

```js
const mixed = () => [ok(300, 'A'), bad(100, 'B failed'), ok(200, 'C')];   // B FAILS first, at 100 ms

Promise.all([ok(300, 'A'), ok(100, 'B'), ok(200, 'C')]);   // 1. all, all pass
Promise.all(mixed());                                      // 2.
Promise.allSettled(mixed());                               // 3.
Promise.race(mixed());                                     // 4.
Promise.any(mixed());                                      // 5.
Promise.any([bad(100, 'X failed'), bad(200, 'Y failed')]); // 6. any, all fail
```
**Predict** for each: ✅ or ❌, with **what** value, after **how many** ms?

<details><summary>👀 Real output + why</summary>

```
1. all (all pass)  ✅ ['A', 'B', 'C']  ~302 ms
2. all             ❌ Error: B failed  ~101 ms
3. allSettled      ✅ [
     { status: 'fulfilled', value: 'A' },
     { status: 'rejected', reason: Error('B failed') },
     { status: 'fulfilled', value: 'C' }
   ]  ~301 ms
4. race            ❌ Error: B failed  ~101 ms
5. any             ✅ 'C'  ~201 ms
6. any (all fail)  ❌ AggregateError: All promises were rejected,
                      .errors = [Error('X failed'), Error('Y failed')]  ~201 ms
```

| Case | Why                                                                   |
|------|-----------------------------------------------------------------------|
| 1    | Waits for the slowest (A). Order = **input** order, not finish order  |
| 2    | Fail-fast: B fails at 100 ms, so `all` rejects right then             |
| 3    | Waits for **all** to finish and **never** rejects; you check `status` |
| 4    | B **settled** first. A failure counts as "finished" too               |
| 5    | First **success** = C at 200 ms. B's failure is simply ignored        |
| 6    | Nobody passed. `AggregateError` keeps **every** reason in `.errors`   |
</details>

### Which one when? (ShopLite examples)

| Use          | When                                                               |
|--------------|--------------------------------------------------------------------|
| `all`        | you need **every** piece: product page = product + reviews + stock |
| `allSettled` | partial success is OK: send 50 order emails, report the failures   |
| `race`       | a **time limit**: "the payment API gets 5 s, then we give up"      |
| `any`        | the **fastest** of several copies: read from 3 mirrors/replicas    |

🎤 **Ready to speak: "all vs allSettled vs race vs any?"**
> "All four take a list of promises. `Promise.all` waits for all of them and gives the values in input order,
> but it's fail-fast: the first rejection rejects the whole thing. I use it when I need every result.
> `allSettled` never rejects; it gives a status for each one, so it's for partial success, like sending
> a batch of emails and logging the failures. `race` settles with whichever finishes first, pass or fail;
> the classic use is a timeout. `any` gives the first *success* and only fails, with an `AggregateError`,
> if every promise fails. That's good for trying several mirrors. One catch for all of them: the losers
> are **not cancelled**; they keep running in the background."

## 5. 🤔 Puzzle 4: `Promise.all` failed… did the other tasks STOP?

```js
async function save(name, ms) { await sleep(ms); console.log(`${name} saved`); }
async function chargeCard(ms) { await sleep(ms); throw new Error('payment failed'); }

try {
  await Promise.all([save('order', 300), chargeCard(100), save('invoice', 200)]);
  console.log('order placed');
} catch (err) {
  console.log('caught:', err.message);
}
console.log('request finished → sent 500 to the user');
```
**Predict:** the order of the printed lines. Do the `saved` lines print at all?

<details><summary>👀 Real output + why</summary>

```
caught: payment failed
request finished → sent 500 to the user
invoice saved        ← 😱 after we already told the user "error"
order saved
```
- Promises **can't be cancelled**. `Promise.all` only **stops waiting**; the work keeps running in the background.
- So the user got an error, but the order and the invoice were **still saved**: an order with no payment. Bad data.
- **Fixes:**
  - Steps that depend on each other go **one by one**: charge the card first, save only if that passed.
  - Put the DB writes in a **transaction**: all of them succeed, or all roll back (Day 18).
  - Some APIs can really stop: pass an `AbortSignal`, e.g. `fetch(url, { signal })`.
</details>

## 6. Real use of `race`: a time limit ⏱️

```js
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));   // 🔑 clear the timer
}

await withTimeout(sleep(100).then(() => 'done'), 2000);   // work wins at 100 ms
await withTimeout(sleep(500), 200);                       // timer wins at 200 ms → throws
```

Real output, with and without the `clearTimeout`:
```
$ node playground/day03/05-with-timeout.js            ← forgets clearTimeout
fast: done
slow: timed out after 200 ms
process exited at ~2001 ms      ← the unused 2000 ms timer kept the process alive

$ node playground/day03/05-with-timeout.js clear
fast: done
slow: timed out after 200 ms
process exited at ~604 ms
```
- **Why ~604 ms and not ~300?** The slow `sleep(500)` **lost** the race but kept running (puzzle 4 again!).
  It started at ~100 ms, so it ended at ~600 ms.
- **Trap:** forget `clearTimeout` and the timer stays alive. In a server, every request leaves a live timer behind.
- **Modern shortcut:** `fetch(url, { signal: AbortSignal.timeout(5000) })`. It times out **and** really cancels the request.

## 7. What blocks the loop? (the hidden list) 🧱

Simple si baat: anything that keeps the **main thread** busy with sync work. While it runs, no callback, no timer
and no other request can move. Day 1 showed the obvious one (a `while` loop). Interviewers ask for the **hidden** ones:

| Blocker                 | Example                              | Fix                         |
|-------------------------|--------------------------------------|-----------------------------|
| `…Sync` APIs in a route | `readFileSync`, `pbkdf2Sync`         | the async version (pool)    |
| Huge JSON               | `JSON.parse` of a 50 MB request body | limit body size; stream it  |
| Heavy loops / sorting   | sort 1M rows, resize an image in JS  | `worker_threads` or a queue |
| A bad regex (**ReDoS**) | `/^(a+)+$/` on user input            | safe regex; cap input size  |
| Endless microtasks      | recursive `process.nextTick` (Day 2) | `setImmediate` / chunks     |

- `…Sync` at **startup** (reading a config file once) is fine. Inside a **request handler** it freezes every user.
- **ReDoS** = Regular expression Denial of Service: a regex that takes exponential time on a crafted input.
  Measured on this laptop (`/^(a+)+$/.test('a'.repeat(n) + '!')`):
  ```
  20 chars:  54 ms
  24 chars: 113 ms
  26 chars: 439 ms      ← a few more characters and one request freezes the server for seconds
  ```

### 🤔 Puzzle 5: the same hash, sync vs async. Does the heartbeat keep beating?

```js
const heartbeat = setInterval(() => console.log(`💓 beat at ${at()}`), 100);   // "other users"

console.log(`hashing a password (${mode})…`);
if (mode === 'sync') {
  crypto.pbkdf2Sync('my-password', 'salt', 4_000_000, 64, 'sha512');   // ~1 s of CPU work
} else {
  await pbkdf2('my-password', 'salt', 4_000_000, 64, 'sha512');        // promisified crypto.pbkdf2
}
console.log(`hash done at ${at()}`);
```
**Predict:** how many 💓 lines print **while** hashing, in each mode?

<details><summary>👀 Real output + why</summary>

```
$ node playground/day03/06-heartbeat.js sync
hashing a password (sync)…
hash done at 1040 ms
💓 beat at 1040 ms          ← first beat, ~940 ms late
💓 beat at 1140 ms
💓 beat at 1241 ms

$ node playground/day03/06-heartbeat.js async
hashing a password (async)…
💓 beat at 101 ms
💓 beat at 201 ms
   … one beat every ~100 ms …
💓 beat at 1118 ms
hash done at 1147 ms
💓 beat at 1219 ms
💓 beat at 1320 ms
```
- **sync:** `pbkdf2Sync` runs on the **main thread**. For ~1 s the loop is stuck, so there are **0 beats**.
  The ~10 missed beats are **skipped, not replayed**: `setInterval` fires once, late, and carries on.
- **async:** `crypto.pbkdf2` hands the work to a **libuv thread**. The main thread stays free, so the heart
  keeps beating (11 beats during the hash).
- Same work, about the same ~1 s. The difference is **who waits**: with sync, every user; with async, nobody.
</details>

## 8. The libuv thread pool 🧵 (4 helpers, not infinite)

🧠 **Memory hook (Day 1 restaurant):** the waiter (main thread) only takes orders. Slow jobs go to the kitchen,
which has just **4 cooks** (the thread pool). Order #5 waits until a cook is free.

| Uses the **thread pool** (4 by default)          | Does **not** use the pool        |
|--------------------------------------------------|----------------------------------|
| `fs.*` (files)                                   | network: `http`, TCP, DB sockets |
| `crypto.pbkdf2` / `scrypt` / `randomBytes`       | timers                           |
| `zlib` (async gzip)                              |                                  |
| `dns.lookup` (`http.get('example.com')` uses it) |                                  |

- **Why isn't network in the pool?** The OS itself can watch thousands of sockets at once (`epoll` on Linux,
  `kqueue` on macOS), so no thread has to sit and wait. That's how one Node process holds 10,000 connections.
- So your Postgres queries (sockets) don't use the pool, but bcrypt-style hashing and file reads do.

### 🤔 Puzzle 6: 8 hashes at once, then one tiny file read

```js
for (let i = 1; i <= 8; i++) {
  crypto.pbkdf2('my-password', 'salt', 1_000_000, 64, 'sha512', () => {   // ~275 ms each, alone
    console.log(`hash ${i} done at ${at()}`);
  });
}
fs.readFile(import.meta.filename, () => console.log(`📄 file read done at ${at()}`));   // alone: ~1 ms
```
**Predict:** when do the hashes finish, and when does the file read finish? Then what changes with
`UV_THREADPOOL_SIZE=8`?

<details><summary>👀 Real output + why</summary>

```
$ node playground/day03/07-thread-pool.js
thread pool size: 4 (the default)
hash 1 done at 275 ms
hash 4 done at 330 ms
hash 2 done at 342 ms
hash 3 done at 342 ms
hash 5 done at 578 ms       ← 2nd wave
📄 file read done at 578 ms  ← 😱 a ~1 ms job took ~578 ms
hash 7 done at 636 ms
hash 8 done at 670 ms
hash 6 done at 678 ms

$ UV_THREADPOOL_SIZE=8 node playground/day03/07-thread-pool.js
thread pool size: 8
hash 1 done at 421 ms
📄 file read done at 428 ms
hash 7 done at 429 ms
hash 5 done at 439 ms
   … hashes 6, 8, 2, 4 …
hash 3 done at 495 ms
```
(A 2nd run of each gave the same pattern: 283–378 then 594–675 ms; and 358–479 ms.)

| What you see                 | Why                                                           |
|------------------------------|---------------------------------------------------------------|
| Two waves of 4 (default)     | Only 4 threads. Hashes 5–8 **wait in a queue** for a free one |
| The file read waits ~578 ms  | It's job #9 in the **same** queue, behind all 8 hashes        |
| Size 8: all done by ~495 ms  | All 8 run at once, so no 2nd wave                             |
| Size 8: each hash is slower  | 8 threads share 8 cores (2 are slow "efficiency" cores)       |
| Size 8: the file still waits | All 8 threads were busy; job #9 still queues                  |

- 🚀 **Real life:** many logins at once (password hashing, Day 22) can fill the pool and slow **every** file read
  and DNS lookup in the app.
- `UV_THREADPOOL_SIZE` (max 1024): set it in the **environment, before Node starts**. More threads than CPU cores
  doesn't make CPU work faster; each job just gets slower.
</details>

🎤 **Ready to speak: "What is the libuv thread pool?"**
> "Node runs my JavaScript on one main thread, but libuv keeps a small pool of helper threads, 4 by default.
> Work the OS can't do asynchronously goes there: file system calls, `dns.lookup`, crypto like `pbkdf2`
> and `scrypt`, and zlib. Network I/O doesn't use the pool, because the OS can watch many sockets at once
> with epoll or kqueue. The catch is that 4 is small: if I start 8 heavy hashes, 4 wait in a queue, and even
> a tiny file read waits behind them. You can raise it with `UV_THREADPOOL_SIZE`, but beyond the number of
> cores it won't speed up CPU work. For real CPU-heavy work I'd use worker threads or a job queue."

## 9. 🛠️ Build: your own `promiseAll` and `promisePool`

"Implement `Promise.all`" is one of the most common live-coding questions for Node roles.
`promisePool` (a concurrency limit) is its senior-level follow-up.

- **You write:** the two function bodies in `playground/day03/promise-utils.js`.
- **Tests (Claude wrote them):** `playground/day03/promise-utils.test.js`.
```bash
node --test playground/day03/promise-utils.test.js
node --test --test-name-pattern=promiseAll playground/day03/promise-utils.test.js   # one group only
```
**Done =** `ℹ pass 15`, `ℹ fail 0`, `ℹ cancelled 0` (a hang shows up as "cancelled" + "test timed out").

**`promiseAll(items)`**, your own `Promise.all` (without using `Promise.all` / `allSettled` / `race` / `any`):
- resolves with every value in **input** order
- plain values are allowed: `[1, delay(10, 2)]` → `[1, 2]`
- `[]` → `[]` right away (no hang)
- **fail-fast:** rejects with the first error *in time*, without waiting for the rest; a 2nd failure must not crash

**`promisePool(tasks, limit)`**: run async tasks, at most `limit` at a time:
- `tasks` are **functions** that start the work, e.g. `() => sendEmail(user)`
- never more than `limit` running, and it does use all `limit` slots
- when one task finishes, the next one starts **right away** (no batches)
- results in **input** order; `[]` for no tasks; rejects when a task fails
- you **may** use your own `promiseAll` inside it

🤔 **Think before you code** (the first rung of the hint ladder):
1. The promises finish in random order. How do you put each value in the **right slot**?
   How do you know when the **last** one is done?
2. Why won't `for (const p of items) results.push(await p)` pass? (Puzzle 2.)
3. Why does `promisePool` take **functions**, not promises? (Puzzle 1, case D.)
4. Batches of 2 vs a real pool: what's the difference? (The "refills a free slot" test checks this.)

### Review, round 1 (10-30)

The first version passed the first 11 tests. Then 4 edge-case tests were added (15 in total), and it got 12/15.

✅ **Good:**
- `results[index]` + a counter → input order, and "the last one is done" is detected correctly.
- `Promise.resolve(item)` handles plain values.
- The pool is a **real** pool: each finished task calls `runNext()`, which refills the slot at once (no batches).
- `Promise.resolve().then(() => taskFn())` turns a task that throws **synchronously** into a rejection.
- After a failure, the pool stops starting new tasks. That's nice, and more than the spec asked.

🔧 **Fix:**

| Problem                                  | What happens                              |
|------------------------------------------|-------------------------------------------|
| `throw new Error('TODO')` after `return` | dead code (lint: `no-unreachable`)        |
| `!Array.isArray(items)` → `resolve([])`  | a `Set` silently becomes `[]`: data lost! |
| same check, input `undefined`            | gives `[]`; the real one: `TypeError`     |
| `limit` = 0                              | nothing ever starts → hangs **forever**   |

Real output, yours vs the real `Promise.all`:
```
yours: promiseAll(new Set([1, 2]))   ✅ []
real:  Promise.all(new Set([1, 2]))  ✅ [ 1, 2 ]
yours: promiseAll(undefined)         ✅ []
real:  Promise.all(undefined)        ❌ TypeError: undefined is not iterable (cannot read property Symbol(Symbol.iterator))
yours: promisePool(tasks, 0)         ✅ ⏳ still pending after 300 ms
```
- 🧠 **Lesson:** don't hide bad input by returning a "safe" default. Fail loudly, so the caller's bug shows up.
- `isRejected` in `promiseAll` is **not needed**: a promise settles **once**, so later `resolve`/`reject` calls are ignored.
  In `promisePool` it *is* useful: `runNext()` checks it so no new tasks start after a failure.

*(The final version and your explain-back go here.)*

---

## 10. 🔁 Recall check (Day 4 opening, 11-01)

Try each one from memory first. The answers are hidden.

**R1.** A handler takes 300 ms. The 3 calls don't depend on each other:
```js
const user = await getUser(id);            // 100 ms
const cart = await getCart(id);            // 100 ms
const recs = await getRecommendations(id); // 100 ms
```
Make it ~100 ms. If `getCart` fails after 10 ms, what happens? Why is that safer than
"start all three, then `await` them one by one"?

<details><summary>✅ Answer</summary>

```js
const [user, cart, recs] = await Promise.all([getUser(id), getCart(id), getRecommendations(id)]);
```
- **~100 ms:** all three **start together**, and `Promise.all` waits for the slowest.
- **`getCart` fails at 10 ms:** `Promise.all` **rejects right away** (fail-fast). Your `try/catch`
  (or Nest's exception filter) sends an error response. The other two keep running; their results are ignored.
- **Why it's safer:** with `const p1 = getUser(id); const p2 = getCart(id); await p1; await p2;`, p2 fails while we're
  still stuck on `await p1`. Nobody is listening to p2 yet → **unhandled rejection** → since Node 15 the **whole
  process crashes**, for every user (puzzle 2). `Promise.all` puts a handler on every promise at once, so the error
  is always caught.

*Your answer (11-01): "Promise.all will immediately reject at the 10 ms mark". That's the first half only:
no code, and no "why it's safer".*
</details>

**R2.** Login uses `bcrypt.hashSync(password, 12)` (~250 ms). 20 users log in at once.
What happens to a 21st user who only calls `GET /health`? What's the fix?

<details><summary>✅ Answer</summary>

- They wait **~5 s** (20 × 250 ms), or even time out. `hashSync` runs on the **main thread**, so the 20 hashes run
  back to back, and the event loop can't handle anything else, not even a tiny `/health`.
- **Fix:** the async version, `await bcrypt.hash(password, 12)`. The hashing runs on the **libuv thread pool**,
  the main thread stays free, and `/health` answers in ~1 ms.
- **Follow-up an interviewer may ask: "So now logins are fast?"** No. 20 hashes on 4 pool threads = **5 waves**
  of ~250 ms, so the last login still takes ~1.25 s. The work is the same; it just stops blocking everyone else.
  More help: raise `UV_THREADPOOL_SIZE` up to the core count, rate-limit login (Day 23), or use worker threads.

*Your answer (11-01): the 5 s and the "why" were right, but the **fix** (half the question) was missing.*
</details>

**R3.** Which use the libuv thread pool? (a) `fs.readFile` (b) a Postgres query (c) `crypto.pbkdf2`
(d) `http.get('https://example.com')`

<details><summary>✅ Answer</summary>

| Call                 | Pool?             | Why                                                   |
|----------------------|-------------------|-------------------------------------------------------|
| (a) `fs.readFile`    | ✅ yes            | no portable async file API, so libuv uses a thread    |
| (b) Postgres query   | ❌ no             | it's a **socket**; the OS watches it (epoll / kqueue) |
| (c) `crypto.pbkdf2`  | ✅ yes            | heavy CPU math, done off the main thread              |
| (d) `http.get(host)` | only the DNS step | the request is a socket ❌, but `dns.lookup` ✅       |

- **(d) in detail:** in JS, `dns.lookup` is async (it takes a callback). Under the hood it calls the OS function
  `getaddrinfo()`, which **blocks**, so libuv runs it on a pool thread. (`dns.resolve*` asks DNS servers over the
  network instead, so it doesn't use the pool.)
- *Correction to the pasted answer (11-01): "dns.lookup is synchronous" isn't quite right. The JS function is
  async; it's the C function underneath that blocks.*

🎤 **Spoken version:**
> "File system and crypto use the pool, so `readFile` and `pbkdf2`, yes. A Postgres query, no: it's a socket,
> and the OS watches it with epoll or kqueue. `http.get`: the request itself doesn't, but resolving the hostname
> goes through `dns.lookup`, which calls the blocking `getaddrinfo`, so that step runs on the pool.
> That's why a pool busy with password hashing can even slow down outgoing HTTP calls."
</details>

## 11. 📝 Revision Q&A: Day 3 interview questions

These are the questions interviewers ask on this topic. **Say your answer out loud first**, then open the box.

**Q1. Callbacks vs promises vs async/await: what's the difference?**
<details><summary>✅ Answer</summary>

All three handle "this finishes later" work. A **callback** is a function you pass in; Node calls it with
`(err, result)` when done. Nested callbacks become "callback hell", and it's easy to forget an error.
A **promise** is an object for a future value: `pending` → `fulfilled` or `rejected`, and it settles only once.
Promises chain with `.then`/`.catch`, so the pyramid becomes flat. **async/await** is nicer syntax over promises:
an `async` function always returns a promise, and `await` pauses only that function, so errors go to a normal
`try/catch`. (Section 1.)
</details>

**Q2. Does `await` block the thread?**
<details><summary>✅ Answer</summary>

No. `await` pauses **only the current async function**. The rest of that function becomes a microtask that runs when
the promise settles. Meanwhile the main thread is free, and the event loop keeps serving other requests.
</details>

**Q3. Concurrency vs parallelism: which one does Node do?**
<details><summary>✅ Answer</summary>

**Concurrency** = many tasks *in progress* at once; their waiting overlaps. Node does this on one thread:
100 DB queries can wait at the same time. **Parallelism** = tasks *running* at the same instant on different CPU
cores. Your JS doesn't do that by itself; you need `worker_threads` (or more processes). Behind the scenes, libuv's
thread pool does run some work in parallel (file I/O, crypto). *Ek waiter, kai tables = concurrency;
kai waiters = parallelism.*
</details>

**Q4. `Promise.all` vs `allSettled` vs `race` vs `any`?**
<details><summary>✅ Answer</summary>

- `all`: waits for all, values in **input** order, **fail-fast** on the first rejection.
- `allSettled`: waits for all, **never rejects**, gives `{ status, value | reason }` for each.
- `race`: the first to **settle**, pass or fail. Classic use: a timeout.
- `any`: the first **success**; rejects with `AggregateError` only if all fail.

The full spoken answer is in section 4.
</details>

**Q5. One promise in `Promise.all` fails. Do the others stop?**
<details><summary>✅ Answer</summary>

No. Promises **can't be cancelled**; `Promise.all` only stops **waiting**. The other tasks keep running in the
background (puzzle 4: the order and the invoice were still saved after the user got an error). If the steps must
succeed or fail together, use a DB **transaction**. To really stop work, pass an `AbortSignal` to APIs that
support it, like `fetch`.
</details>

**Q6. How do you put a timeout on a promise?**
<details><summary>✅ Answer</summary>

Race it against a timer that rejects, and **clear the timer** afterwards:
```js
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```
Without `clearTimeout`, the leftover timer keeps the process alive (~2001 ms instead of ~604 ms in the demo).
The slow work itself still runs; `race` doesn't cancel it. For `fetch`, `AbortSignal.timeout(ms)` really cancels.
</details>

**Q7. What blocks the event loop?**
<details><summary>✅ Answer</summary>

Any long **synchronous** work on the main thread: `…Sync` APIs in a request handler (`readFileSync`, `pbkdf2Sync`,
`bcrypt.hashSync`), `JSON.parse` of a huge body, heavy loops or sorting, a catastrophic regex (**ReDoS**), and
endless microtasks (recursive `process.nextTick`). While it runs, no other request, timer or callback can move.
Fixes: the async version (thread pool), split the work into chunks, `worker_threads`, or a job queue.
</details>

**Q8. What is the libuv thread pool, and what uses it?**
<details><summary>✅ Answer</summary>

A small pool of helper threads, **4 by default** (`UV_THREADPOOL_SIZE`, set before Node starts). It runs work the
OS can't do asynchronously: file system calls, `dns.lookup`, crypto like `pbkdf2`/`scrypt`, and zlib. **Network I/O
doesn't use it**: the OS watches sockets itself (epoll/kqueue). When the 4 threads are busy, new jobs wait in a
queue, so even a tiny file read can wait behind heavy hashes (puzzle 6). The full spoken answer is in section 8.
</details>

**Q9. ★ Live coding: implement `Promise.all`.**
<details><summary>✅ Answer (tested: passes all 15 tests)</summary>

```js
export function promiseAll(items) {
  return new Promise((resolve, reject) => {
    const list = Array.from(items); // any iterable works; undefined throws a TypeError → the promise rejects
    const results = Array.from({ length: list.length });
    let done = 0;
    if (list.length === 0) return resolve(results);

    list.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value; // save at its own index → INPUT order
        done++;
        if (done === list.length) resolve(results);
      }, reject); // the first rejection wins; later calls are ignored
    });
  });
}
```
How to explain it, line by line:
- `Array.from(items)`: accepts any iterable (a `Set` too). For `undefined` it throws, and a throw inside the
  `new Promise` callback **rejects** the promise, just like the real `Promise.all`.
- `Promise.resolve(item)`: turns plain values into promises, so `[1, delay(10, 2)]` works.
- `results[i] = value`: each value goes into **its own slot**, so the order is the input order, not the finish order.
- `done` counter: the promises finish in random order, so we count; when `done === list.length`, everyone is done.
- `reject` as the 2nd argument of `.then`: the first failure rejects at once (fail-fast). Every promise has a
  handler, so a 2nd failure can't crash anything.
- No `isRejected` flag needed: a promise **settles only once**, so extra `resolve`/`reject` calls are ignored.
- The empty check: without it, `done === 0` is never reached by any callback, and the promise hangs forever.
</details>

**Q10. ★ Live coding: run async tasks with a concurrency limit (a "promise pool").**
<details><summary>✅ Answer (tested: passes all 15 tests)</summary>

```js
export async function promisePool(tasks, limit) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`limit must be a whole number >= 1, got ${limit}`);
  }
  const results = Array.from({ length: tasks.length });
  let next = 0; // index of the next task to start

  // One worker = one "slot". It keeps taking the next task until none are left.
  async function worker() {
    while (next < tasks.length) {
      const i = next++; // take a ticket (safe: this line runs without any await in between)
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await promiseAll(workers);
  return results;
}
```
How to explain it:
- **Why `tasks` are functions:** a promise starts the moment it's created (puzzle 1, case D). If you passed
  promises, all the work would already be running and there'd be nothing left to limit.
- **`limit` workers:** each worker is a slot. When its task finishes, the `while` loop takes the next one
  **right away**, so no slot waits for a whole batch (that's the "refills a free slot" test).
- **`next++` has no race condition:** JS runs one thing at a time, and `const i = next++` happens with no `await`
  in between, so two workers can never take the same index.
- **Order:** `results[i]` again keeps the input order.
- **Errors:** if a task fails (or throws synchronously), its worker rejects, so `promiseAll` rejects, so the pool
  rejects. **`limit < 1`** would hang forever (no workers), so it fails loudly with a `RangeError` instead.
- **Real use:** send 10,000 emails, but at most 10 at a time, so you don't overload the mail server or the DB pool.
- Your own version (event-based `runNext()`) is also a correct design; it reached 12/15. The 3 misses are listed
  in the section 9 review.
</details>

---

*Optional: fix your own `promise-utils.js` to 15/15 (the reference answers are in Q9–Q10).*

## ⚠️ Interview traps (so far)

| They say…                                | You say…                                               |
|------------------------------------------|--------------------------------------------------------|
| "`await` blocks the thread."             | No. It pauses **only this function**                   |
| "`forEach` waits for async callbacks."   | No! Use `for…of` or `Promise.all(items.map(…))`        |
| "`Promise.all` runs them in parallel."   | They run once **created**; `all` only waits            |
| "Await started promises one by one."     | An early rejection → unhandled → **crash**             |
| "Node is parallel because it's async."   | **Concurrent** (waits overlap). CPU parallel = workers |
| "`all` returns results in finish order." | **Input** order, always                                |
| "When `all` fails, the others stop."     | They keep running: promises **can't be cancelled**     |
| "`race` gives the first success."        | First **settled**, pass or fail. First success = `any` |
| "`allSettled` rejects if one fails."     | It **never** rejects. Check each `status`              |
| "`Promise.all([])` hangs."               | Resolves `[]` at once. `race([])` never settles        |
| "All async work uses the thread pool."   | Only fs, dns.lookup, crypto, zlib. Network: the OS     |
| "Only `while` loops block the loop."     | Also `…Sync` APIs, huge `JSON.parse`, a bad regex      |
| "A bigger pool makes it faster."         | Not past the core count; each job just gets slower     |