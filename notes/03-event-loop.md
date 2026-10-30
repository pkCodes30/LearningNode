# 03 · The Event Loop ★ (Day 2)

> **The whole topic in one line:**
> **Sync code first → VIP lines (nextTick, then Promises) → the normal lines in a fixed round
> (Timers → Poll → Check → Close)**, and after **every** callback, the VIP lines get emptied again.

Demos (each is a `.cjs` file, i.e. classic CommonJS, which is what interview questions assume):
```bash
node playground/day02/01-order.cjs
node playground/day02/02-io.cjs
```

---

## 1. The players 🎭

| Piece                   | Simple meaning                                           | 🍽️ Waiter version  |
|-------------------------|----------------------------------------------------------|--------------------|
| **Call stack**          | Where JS runs **right now**, one thing at a time         | The waiter's hands |
| **Microtask queues** ⚡ | VIP lines, emptied **fully** whenever the stack is empty | VIP guests         |
| **Macrotask queues** 🕐 | Normal lines, visited in a **fixed round** ("phases")    | Normal counters    |
| **Event loop**          | Keeps picking the next callback                          | The waiter's round |

## 2. The VIP lines (microtasks) ⚡

| Order | Line                     | What goes in                                           |
|-------|--------------------------|--------------------------------------------------------|
| 1️⃣    | `process.nextTick` queue | `process.nextTick(cb)` (Node only, the **super-VIP**)  |
| 2️⃣    | Promise queue            | `.then`/`.catch`, code after `await`, `queueMicrotask` |

🧠 **Memory hook:** **N before P**, just like the alphabet. (**N**extTick before **P**romise.)

## 3. The normal lines: the round (phases) 🕐

```
   ┌─► timers ─────► setTimeout / setInterval callbacks
   │   pending ────► some system-level I/O callbacks
   │   poll ───────► I/O callbacks (file read done, data arrived…)  ← waits here when idle
   │   check ──────► setImmediate callbacks
   └── close ──────► close events (socket.on('close'))
         ⚡ after EVERY single callback: empty the VIP lines (nextTick, then promises)
```
🧠 **Memory hook:** **T-P-P-C-C** → "**T**wo **P**izzas **P**lease, **C**heese **C**rust" 🍕
(**T**imers, **P**ending, **P**oll, **C**heck, **C**lose)

🍽️ **Waiter version:** finish the current table (sync code). Then serve the **owner's family (nextTick)**, then the
**VIPs (promises)**. Then walk the counters in order: Timers → I/O → setImmediate → Close.
After **every** customer, look at the VIP line again.

---

## 4. 🧩 Puzzle 1: who prints first?

`playground/day02/01-order.cjs`
```js
console.log('A: sync start');
setTimeout(() => console.log('B: setTimeout 0'), 0);
setImmediate(() => console.log('C: setImmediate'));
Promise.resolve().then(() => console.log('D: promise.then'));
process.nextTick(() => console.log('E: nextTick'));
console.log('F: sync end');
```
**Output:**
```
A: sync start
F: sync end
E: nextTick
D: promise.then
B: setTimeout 0      ← these two can SWAP! 🪤
C: setImmediate
```

| Step | Printed   | Why                                                       |
|------|-----------|-----------------------------------------------------------|
| 1    | `A`, `F`  | Sync code always runs first                               |
| 2    | `E`       | Stack empty → VIP lines → **nextTick first** (N before P) |
| 3    | `D`       | Then the promise queue                                    |
| 4    | `B` / `C` | Normal lines. **Order NOT guaranteed** 👇                 |

### 🪤 The trap: `setTimeout(0)` vs `setImmediate` in the main file

Real test on this laptop (30 runs): **24× `C` first, 6× `B` first.**

**Why?** `setTimeout(fn, 0)` really means **"at least 1 ms"** (Node turns 0 into 1).
- When the loop reaches the **timers** phase: if 1 ms has passed → `B` runs first.
- If **not yet** (the process started very fast) → skip timers → **check** → `C` first, then `B` on the next round.
- It depends on how fast the process started. *Matlab, kabhi B pehle, kabhi C.* 🎲

🍽️ The timer's food needs at least 1 ms to cook. If the waiter arrives too early, he skips that counter and comes back on the next round.

---

## 5. 🧩 Puzzle 2: the same timers, inside an I/O callback

`playground/day02/02-io.cjs`
```js
const fs = require('node:fs');

fs.readFile(__filename, () => {
  // we are now in the POLL phase (an I/O callback)
  setTimeout(() => console.log('B: setTimeout 0'), 0);
  setImmediate(() => console.log('C: setImmediate'));
});
```
✋ **Predict first:** which prints first, `B` or `C`? Does it change between runs? Why?

<details>
<summary>👉 Answer (open only after predicting!)</summary>

**Output, every single time** (40/40 runs on this laptop):
```
C: setImmediate
B: setTimeout 0
```
**Why?** The `readFile` callback runs in the **poll** phase. Look at the round: right after **poll** comes
**check** (`setImmediate`). **Timers** come only in the *next* round. So `C` always wins. ✅ Guaranteed.

🧠 **Memory hook:** "Inside I/O, **Immediate is immediate**." ⚡

❌ **Most common wrong answer:** "either one can come first", which applies Puzzle 1's rule everywhere.
In Puzzle 1 the doubt came from **where the loop starts** (at timers, where the 1 ms may not have passed yet).
Here we are **already in poll**, so check comes next no matter what. The 1 ms doesn't matter at all.
🍽️ The waiter is standing at the I/O counter. The setImmediate counter is the **very next** one;
the timer counter is **behind** him, so he only reaches it on the next round.

</details>

---

## 6. 🧩 Puzzle 3: async/await joins the party

`playground/day02/03-async-await.cjs`
```js
console.log('1');
setTimeout(() => console.log('2'), 0);
(async () => {
  console.log('3');
  await null;
  console.log('4');
})();
Promise.resolve().then(() => console.log('5'));
process.nextTick(() => console.log('6'));
console.log('7');
```
✋ **Predict the order of the 7 numbers first.**

<details>
<summary>👉 Answer (open only after predicting!)</summary>

**Output, every time** (20/20 runs): `1 3 7 6 4 5 2`

| Step  | Printed                            | Why                                               |
|-------|------------------------------------|---------------------------------------------------|
| sync  | `1`                                | Normal code                                       |
| —     | *(2 → timers line)*                |                                                   |
| sync  | `3`                                | 🔑 **async fn runs sync until its first `await`** |
| —     | *(4 → Promise line)*               | Code after `await` = a hidden `.then`             |
| —     | *(5 → Promise line, **behind** 4)* |                                                   |
| —     | *(6 → nextTick line)*              |                                                   |
| sync  | `7`                                | Normal code                                       |
| micro | `6`                                | **N before P**                                    |
| micro | `4`, `5`                           | Promise line is FIFO: 4 was queued first          |
| macro | `2`                                | Timers phase, last of all                         |

🧠 **Memory hooks:**
- "**Async is sync until the first `await`.**"
- "`await` = *baaki kaam baad mein*": everything after it becomes a microtask, like `.then`.

❌ **Common mistake:** putting `6` (nextTick) **before `7`**. nextTick is a VIP, but it still waits for the
**current sync code to finish**. Nobody, VIP or not, can interrupt the waiter in the middle of a table.

</details>

---

## 7. 🧩 Puzzle 4: starvation (can the VIP line block everyone?)

`playground/day02/04-starvation.cjs`: a function keeps re-scheduling **itself** 100,000 times, while a
`setTimeout(0)` waits.
```bash
node playground/day02/04-starvation.cjs nextTick    # re-schedules itself with process.nextTick
node playground/day02/04-starvation.cjs immediate   # re-schedules itself with setImmediate
```
✋ **Predict first:** in each mode, does the timer fire **early** or **only at the very end**?

<details>
<summary>👉 Answer (open only after predicting!)</summary>

**Real output on this laptop:**
```
nextTick  → ✅ loop finished, count = 100000   then   ⏰ timer fired when count = 100000
immediate → ⏰ timer fired when count = 1 (or 6, or 47…)   then   ✅ loop finished, count = 100000
```
**Why?**
- The microtask (VIP) line is emptied **completely** before the loop moves on. If a nextTick keeps adding
  **another** nextTick, the line never becomes empty, so timers and I/O **starve** (they never get a turn).
  With an endless chain, the server **freezes**: no requests get served. 🥶
- `setImmediate` callbacks added during the **check** phase wait for the **next round**, so the loop keeps
  moving and the timer gets its turn early.

🧠 **Memory hook:** "**VIP line never empty → restaurant stuck.**"
**Rule:** for long or repeating work, yield with `setImmediate` (or split it into chunks), not a `nextTick`/promise loop.

</details>

---

## 8. 🧩 Puzzle 5: microtasks after each PHASE, or after each CALLBACK?

`playground/day02/05-micro-after-each.cjs`: two timers, and each one queues a promise.
```js
setTimeout(() => {
  console.log('timeout 1');
  Promise.resolve().then(() => console.log('  promise from timeout 1'));
}, 0);
setTimeout(() => {
  console.log('timeout 2');
  Promise.resolve().then(() => console.log('  promise from timeout 2'));
}, 0);
```
**Real output** (20/20 runs, Node 24):
```
timeout 1
  promise from timeout 1     ← drained BEFORE timeout 2 runs
timeout 2
  promise from timeout 2
```
**Why?** Since **Node 11**, microtasks are drained **after every single callback**, not just at the end of a phase.
(Very old Node, 10 and below, printed `timeout 1, timeout 2, promise 1, promise 2`. Many old blog posts and AI answers still say "after each phase", so be careful!)

🧠 **Memory hook:** "**After every customer, check the VIP line.**" Not after every counter: after every *customer*.

---

## 🎤 Interview answers (practise saying these out loud)

**Q: What is the event loop?**
> Node runs JavaScript on a single thread. The event loop is what lets that one thread handle many tasks:
> when the call stack is empty, it picks the next ready callback from its queues. It goes around in phases
> (timers, pending, poll for I/O, check for `setImmediate`, and close callbacks), and after every
> callback it drains the microtask queues: first `process.nextTick`, then promises.

**Q: What's the difference between microtasks and macrotasks?**
> Microtasks (`process.nextTick` and promise callbacks) run as soon as the current operation finishes,
> and the queue is drained completely, before the loop moves on. Macrotasks (timers, I/O callbacks, `setImmediate`)
> are handled phase by phase, one callback at a time, with microtasks drained after each one.

**Q: `setTimeout(fn, 0)` vs `setImmediate(fn)`: which runs first?**
> In the main module it's not guaranteed. `setTimeout(0)` is really at least 1 ms, so it depends on whether that
> threshold has passed when the loop enters the timers phase. Inside an I/O callback, `setImmediate` always runs first,
> because the check phase comes right after the poll phase.

**Q: `process.nextTick` vs `Promise.then`?**
> Both are microtasks, but the nextTick queue is drained before the promise queue. So nextTick runs first.

**Q: What actually happens at an `await`?**
> An async function runs synchronously until its first `await`. At the `await`, the function pauses and the
> rest of it is scheduled as a microtask, just like a `.then` callback. So code after `await` runs only after
> the current synchronous code (and any earlier microtasks) has finished, but before timers and I/O callbacks.

**Q: What is event-loop starvation?**
> The microtask queues are drained completely before the loop moves on. So if code keeps adding new
> microtasks, for example a recursive `process.nextTick` or a promise chain, the queue never empties. Timers
> and I/O never get a turn, and the server stops responding. The fix is to yield with `setImmediate`, or to
> split the work into chunks, so the loop can keep moving.

## ⚠️ Interview traps

| They say…                                    | You say…                                                    |
|----------------------------------------------|-------------------------------------------------------------|
| "`setTimeout(fn, 0)` runs immediately."      | No: after sync code + all microtasks (and ≥ 1 ms)           |
| "`setImmediate` runs immediately."           | No 😄 **check** phase. `nextTick` actually runs sooner      |
| "setTimeout(0) always beats setImmediate."   | Main module: random. Inside I/O: `setImmediate` wins        |
| "Promises are macrotasks."                   | No. Promise callbacks are **microtasks**                    |
| "An async fn runs fully in the background."  | No. It runs **sync until its first `await`**                |
| "nextTick runs before everything."           | Before other **async** work. Never before **sync** code     |
| "Looping with recursive `nextTick` is fine." | It **starves** the loop (no timers/I/O). Use `setImmediate` |
| "Microtasks run after each **phase**."       | Node ≤ 10 only. Since **Node 11**: after **every callback** |
| "The event loop has its own thread."         | No. Same **main thread** as JS; libuv manages the queues    |
