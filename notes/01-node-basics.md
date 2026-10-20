# 01 · Node Basics (Day 1)

> **The whole day in one line:**
> Node = JS outside the browser. **One waiter** (thread), **big kitchen** (libuv).
> Waiting is free 😌, but cooking yourself blocks everyone 😤.

---

## 1. How does the terminal find `node`? (PATH)

- **PATH = a list of folders.** The terminal checks them **left → right**, and the **first match wins**.
- 🔑 **Rule:** whoever edits PATH **last** and puts their folder in front wins.
- `which -a node` lists every `node`. The **first line** is the one that runs.
- A **login** terminal runs `~/.zprofile` + `~/.zshrc`.
  Our project terminal is **non-login**, so it runs `~/.zshrc` only.
- Our setup: Node 24 is used **only in this project** (`.vscode/settings.json`). Other projects keep v23.

## 2. Which Node version?

| Version | Type | Support | Use in production? |
|---|---|---|---|
| **Even** (20, 22, 24) | **LTS** | ~2.5 years | ✅ Yes |
| **Odd** (21, 23, 25) | Current | ~6 months | ❌ Never |

🧠 **Memory hook:** **E**ven = **E**nterprise.

⭐ **Bonus point:** pin the version so laptop, CI and production all match:
`.nvmrc` + `"engines"` in package.json + the Docker image tag.

## 3. What is Node? Three parts

| Part | Simple meaning |
|---|---|
| **V8** | 🧠 The *brain*. Understands and runs JS (same engine as Chrome). Knows nothing about files or network. |
| **libuv** | 🙌 The *hands*. Does the slow outside work (files, network, timers). Has the **event loop** + a **thread pool (4 threads)**. |
| **Node APIs** | 🔘 The *buttons*: `fs`, `http`, `crypto`. Your JS presses them, and libuv does the work. |

🧠 **Memory hook:** **"V8 thinks, libuv works, APIs connect."**

## 4. The waiter analogy 🍽️

- **Waiter** = the main thread (runs your JS).
- **Kitchen** = libuv + OS (does the slow work).
- The waiter takes an order, gives it to the kitchen, and **moves on to the next table**. He doesn't stand and wait.
- Food ready → the kitchen rings a bell (**callback**) → the waiter delivers.
- So **1 waiter handles 1000s of tables**, because he never waits idle.

## 5. I/O-bound vs CPU-bound

| | Meaning | Examples | Node? |
|---|---|---|---|
| **I/O-bound** | Waiting for something outside | DB query, API call, file read | ✅ Great |
| **CPU-bound** | Heavy calculation | Image resize, big loops, video encoding | ❌ Blocks everyone (fix: `worker_threads`, Day 7) |

## 6. "Node is single-threaded": only half true ½

- **Your JS** → **1 thread** (the waiter).
- **File, crypto, DNS work** → the libuv **thread pool** (4 helper threads by default).
- **Network** → the **OS** handles it (no extra threads at all).

## 7. Experiment: blocking the loop

File: `playground/day01/blocking.js`. Timer set for 100 ms + a 2-second `while` loop.

**Output:** `loop done` first, then `timer fired after ~2000 ms`.

**Why?** The timer was ready at 100 ms, so its callback waited in the **queue**. But the waiter was **stuck in the loop**. Callbacks run only when the current JS is finished, so the timer ran at 2000 ms.

🔑 **Rules:**
- `setTimeout(fn, 100)` = "after **at least** 100 ms". It can be late, never early.
- **Never block the event loop.** One heavy task freezes **every** user's request.
- Common culprits: any `*Sync` function in a request (`readFileSync`, `bcrypt.hashSync`), a huge `JSON.parse`, big loops, bad regex.

## 8. Interview answers 🎤 (practise saying these out loud)

**Q: What is Node.js, and why is it good for I/O-heavy apps?**
> Node.js is a JavaScript runtime environment that lets JS run outside the browser, on the server.
> My JS runs on a single thread. Slow work like DB, files and network is handed to libuv and the OS,
> so the main thread doesn't block. Because the main thread never sits idle waiting, one Node server
> can handle thousands of concurrent connections. Its weakness is CPU-heavy work: that blocks the
> single main thread and freezes the server for everyone.

**Q: Which Node version would you use in production?**
> The newest LTS (even-numbered) version, today Node 24. LTS gets about 2.5 years of security
> fixes and libraries test against it. I'd never use odd versions in production, because their support
> ends in about 6 months. And I'd pin the version with `.nvmrc`, `engines` and the Docker image tag.

**Q: Why did the 100 ms timer fire after 2 seconds?**
> JS runs on one thread. The timer's callback was ready, but it had to wait in the queue
> until the blocking loop finished. `setTimeout` gives a *minimum* delay, not an exact one.

## ⚠️ Interview traps

| They say… | You say… |
|---|---|
| "Single-threaded, so Node does one thing at a time?" | JS runs one thing at a time, but **I/O happens in parallel** in the background. |
| "`setTimeout(fn, 0)` runs immediately?" | No. It runs **after the current code finishes**. |
| "Node is good for everything?" | Not for CPU-heavy work. Use `worker_threads` or a separate service. |
