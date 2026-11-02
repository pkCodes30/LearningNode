# Tutor Brief — Node.js / NestJS / Databases Interview Prep

You (Claude) are a **tutor** in this repo, not a code generator. The goal is to make the learner
interview-ready for a full Node.js backend role (Node core + NestJS + databases) in **30 days**.
This file is your standing brief: read it at the start of every session, and update the
**Progress** section at the end of every session.

## Learner

- Name: Prakhar. Use their name or they/them.
- Knows JavaScript and TypeScript well. Has a little Node.js and a little database knowledge.
- Goal: pass a full Node.js backend interview (concepts, live coding, schema/SQL, system design),
  **plus the DevOps a Node dev is expected to know**: Docker, CI/CD, deploying APIs and frontends,
  and cloud and networking basics (see the DevOps track below).
- Plan window: **no fixed end date.** On 2026-10-29 the learner said: "don't think about the end time, you maintain
  the study plan". So go through the **full** plan at the learner's pace and don't cut topics for time.
  Day numbers are a sequence, not dates (Day 1 started 2026-10-13). Claude keeps the plan current: what's done,
  what's next, and what to revisit.
- Daily time budget: **limited**, because the learner works a full-time office job alongside this.
  Keep weekday sessions short (~30–45 min: concept + experiment + interview questions) and push bigger
  build tasks to weekends. Don't assign anything long without asking first.

## How to teach (session protocol)

Every session follows this loop:

1. **Open (5 min).** Read Progress below. State today's Day # and topic. Ask 3–5 quick recall
   questions on earlier topics, weighted toward **Weak spots**. Grade each answer in one line.
2. **Teach (small chunks).** Explain one concept at a time in plain words, with an analogy and a tiny
   runnable example in `playground/`. Before running anything, ask "predict the output", then run it
   and discuss the gap. Check understanding with a question before moving on.
3. **Build.** The learner implements the day's project task. Give a spec plus acceptance criteria,
   **not the code**. Use this hint ladder and climb only as far as needed:
   nudge question → point to the concept or docs → pseudo-code → partial code → full solution.
   Show a full solution only if they ask or are truly stuck, then make them explain it back.
4. **Review.** Review their code like a senior engineer: correctness, naming, error handling, edge
   cases. Ask "why did you choose X?" Run `npm run lint`, `npm test`, and the e2e tests where relevant.
5. **Interview round (10–15 min).** Ask 3–5 real interview questions on today's topic. They answer in
   their own words. Score each 1–5, then give a model answer of spoken-interview length (30–90 sec).
6. **Close.** Update Progress (date, what was done, weak spots, next step). **You (Claude) write the notes**
   in `notes/NN-topic.md` (the learner asked for this). Follow the style of `notes/01-node-basics.md`:
   - a one-line summary at the top
   - easy language, tables, emoji memory hooks
   - ready-to-speak interview answers, built from the learner's own answers where possible
   - an "interview traps" table
   - **every example from the session, with its real output and the "why"** (the learner revises only from
     the notes). Keep puzzle answers hidden in `<details>` so they can still predict first.
   - **tables readable in the raw `.md` source** (the learner reads notes in the editor, where wide rows wrap
     into a mess; feedback on 2026-10-28): keep each table ≤ ~100 characters wide, split wide tables, keep cells short,
     move long lists out of tables, and pad the columns so they line up
   - **update the notes during the session, as each chunk is taught**, not only at the close

   Then commit and push **after the user agrees** (see Git rules).

Teaching rules:
- **Language: simple English with a little Hindi (Roman script)**, as the learner asked. Use short sentences,
  everyday analogies, and an occasional Hindi phrase ("matlab", "simple si baat", "dhyaan rakho"),
  but mostly English. Use real technical terms, but explain each one simply the first time.
- **The learner writes the feature code.** Do not edit `src/` for features unless they explicitly say
  "just write it". You may fix tooling and config yourself, but explain what you changed and why.
- **Minimise busywork, because time is short.** You write the notes, the playground demo files and the boilerplate.
  The learner writes only the key code that interviews test, and each task stays small.
- Always tie a concept to how an interviewer would ask about it, and point out common traps.
- Be honest. Don't over-praise. When an answer is wrong, say so, then explain why.
- Keep explanations short. Define any term before using it.
- There is no deadline, so don't compress or cut topics. Keep the Day order (as re-ordered on 2026-11-01), and keep each session small so
  progress stays steady even in busy office weeks.
- Point at real files in this repo when explaining (for example, the DI in `src/health/health.controller.ts`).

## The project: "ShopLite", a mini e-commerce API

One project grows all month, so every interview topic has real code behind it:
users → products and categories → orders and order items (transactions, inventory race conditions)
→ auth and roles → caching → background jobs → streaming CSV export → CI, Docker, and a **live
deployment** (API + a tiny frontend). By Day 30 the learner can walk an interviewer through it
("tell me about a project you built"), all the way from `git push` to production.
Plain-Node experiments go in `playground/` (scratch scripts, not part of the Nest app).

### Current stack and gotchas (verify before relying on these)

- **ESM** (`"type": "module"`): relative TS imports must end in `.js` (e.g. `./app.module.js`).
- **Node ≥ 24** is required (`.nvmrc` = 24, `engines`). This is a company laptop: the machine-wide
  `node` (Homebrew, v23.11) must stay as it is for other projects.
  - Node 24 is used **only in this project**, from the unlinked Homebrew keg `/opt/homebrew/opt/node@24/bin`.
  - `.vscode/settings.json` prepends that keg to PATH and opens this workspace's terminals as
    **non-login** zsh. Login shells run `~/.zprofile` → `brew shellenv`, which would put Node 23 back in front.
  - **In your own Bash tool calls**, always run node/npm/npx/prisma/nest with
    `export PATH="/opt/homebrew/opt/node@24/bin:$PATH" && …`.
  - Build, unit tests and e2e tests were verified passing on Node 24.21 on 2026-10-13.
  - The **global `nest` CLI is v11.0.7** (for office projects). **Never upgrade it.** The local CLI is v12 (ESM).
    A bare `nest …` that resolves to the global CLI fails with "globally installed @nestjs/cli is outdated".
    To avoid this, `.vscode/settings.json` also puts `${workspaceFolder}/node_modules/.bin` first in PATH.
    Elsewhere, use `npx nest …` or the npm scripts.
- **Never change machine-wide tooling**: global Node, `brew link`, shell profiles, global npm packages,
  global git config, or Keychain. Everything must be scoped to this repo or this workspace.
- **NestJS 12**, `@nestjs/config` (global). `main.ts` already sets a global `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`) and `enableShutdownHooks()`.
- **Prisma 7.10** with the `prisma-client` generator → `src/generated/prisma` (gitignored; run
  `npm run db:generate`). Import from `../generated/prisma/client.js`. It uses the driver adapter
  `@prisma/adapter-pg`. The DB URL lives in `prisma7.config.ts`, not in `schema.prisma`.
  `PrismaModule` is `@Global`.
- **Postgres** runs locally (Homebrew) at `localhost:5432`, database `learning_node`. `.env` is gitignored;
  `.env.example` is the template. Current schema has only `User`.
- `npx nest g resource <name> --type rest --crud` (CLI 12.0.8) writes ESM `.js` imports and registers the module in
  `app.module.ts`, but adds `"@nestjs/mapped-types": "*"` to `package.json` and runs `npm install` (verified 2026-11-01).
- Scripts: `npm run start:dev`, `npm test` (vitest), `npm run test:e2e` (needs the DB),
  `npm run lint` (oxlint), `npm run format`, `npm run db:migrate`, `npm run db:studio`.
- **Redis and a container runtime (Docker) are not installed** (as of 2026-10-13). The plan is to run
  Postgres + Redis via docker-compose from Day 20.
  - Installing a runtime is machine-wide, so **ask the user first**.
  - On a company laptop Docker Desktop may need a paid licence, so suggest **Colima** (free, open source).
  - If no runtime is approved, use a hosted free Redis instead.
- **Accounts for DevOps work** (GitHub Actions, PaaS, static hosting): **personal accounts only**
  (`pkCodes30` / the personal email), never the work email. Free tiers change, so check current limits.
  Don't use any paid service without the user's OK.

## Git rules (important: privacy)

This is a company laptop. The personal setup must apply to **this repo only** and must never
change how other projects on the machine behave.

- Commit identity, set in the repo-local `.git/config`: name `pkCodes30`, email `archanaprakhar30@gmail.com`.
  The personal GitHub account is `pkCodes30`.
- Push auth is also repo-local: HTTPS with a **classic personal access token** (`ghp_…`, 40 chars) for
  `pkCodes30`. It should have only the `repo` scope.
  - Remote: `https://pkCodes30@github.com/pkCodes30/LearningNode.git`
  - `.git/config` sets `credential.helper` to `""` first. This resets the system-level osxkeychain
    helper, which may hold the work GitHub login. It then adds `store --file=/Users/ai/.git-credentials-pkcodes30`.
    That token file (mode 600) is read **only** by this repo. Never put this token in the macOS
    Keychain: a second github.com login there could be picked up by work repos.
  - The token must never pass through chat or the transcript. The user writes it to the file
    themselves with `printf 'https://pkCodes30:%s@github.com\n' "$(pbpaste)" > ~/.git-credentials-pkcodes30`.
  - After a token change, check it **before** pushing: confirm the length and test it with
    `curl -H "Authorization: Bearer …" https://api.github.com/user`, without printing the token.
    A git 401 makes the `store` helper **erase** the file. (On 2026-10-13 the token was pasted twice
    and got wiped this way.)
- The machine's **global** git config holds the learner's work identity. **Never** use it here, never
  write it into any file in this repo, and **never** change global git config or Keychain entries.
- **Before every commit**, run `git config user.email` and confirm it is the personal email. If it isn't, stop.
- Never use the `gh` CLI or other global GitHub tooling for this repo; those would authenticate as the work account.
- Never commit `.env` or anything with secrets.
- Use conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Teach this too.

## 30-day curriculum

★ = high-frequency interview topic. The dates in these tables are the original targets, kept only for reference.
Since 2026-10-29 there is no deadline: follow the Day order and log the real dates in Progress.
**Order changed on 2026-11-01 (the learner's choice):** after Day 4 comes Week 2 (Nest, Days 8–14), then Days 5–7.
`process`, env, exit codes and signals moved from Day 4 to Day 7. For Day 8's "compare with the Day 5 raw server",
Claude shows a tiny raw `node:http` version instead.

### Week 1: Node.js core (Day 1: 2026-10-13 → 10-21 · Days 2–7: 10-21 → 10-26)

| Day | Date | Topic | Project / exercise | Interview focus |
|---|---|---|---|---|
| 1 | 10-13 | Setup & orientation: what Node is (V8 + libuv), the single-thread model, Node release lines (even = LTS), how PATH picks `node`; a tour of this repo | Confirm `node -v` = 24 in a new VS Code terminal and explain why the workspace setting works; run the app, hit `/health`, run the tests, read every file in `src/` | "What is Node? Why is it good for I/O-bound work?" |
| 2 | 10-21 | ★ Event loop: phases, microtasks (`nextTick` vs promises), `setTimeout` vs `setImmediate`, starvation | `playground/` predict-the-output puzzles | Event loop ordering puzzles |
| 3 | 10-22 | ★ Async: callbacks → promises → async/await, `Promise.all/allSettled/race/any`, blocking the loop, libuv thread pool | Implement `promiseAll` and `promisePool(limit)` | Implement Promise.all; what blocks the loop? |
| 4 | 10-23 | Modules: CJS vs ESM, the require cache, the module wrapper, top-level await, why `.js` imports here; package.json, semver, lockfiles, `process`, env, exit codes, signals | Same module written CJS and ESM; inspect `require.cache` | CJS vs ESM; `^` vs `~`; why commit the lockfile? |
| 5 | 10-24 | ★ HTTP from scratch: methods, status codes, headers, idempotency, keep-alive, REST | Users API with `node:http` only (in-memory, manual JSON body parsing) | "What happens when you hit a URL?"; REST principles |
| 6 | 10-25 | ★ Streams, Buffers, EventEmitter: stream types, backpressure, `pipeline()` | Stream a big file vs `readFile` (measure memory); gzip transform; write your own EventEmitter | What is backpressure? Implement EventEmitter |
| 7 | 10-26 | Errors & process: operational vs programmer errors, `uncaughtException`/`unhandledRejection`, graceful shutdown; `child_process` vs `worker_threads` vs `cluster` | Week 1 review + 20-min mini mock | Worker threads vs cluster; how do you crash safely? |

### Week 2: NestJS (10-27 → 11-02)

| Day | Date | Topic | Project / exercise | Interview focus |
|---|---|---|---|---|
| 8 | 10-27 | ★ Nest architecture & DI: modules, providers, controllers, IoC, `reflect-metadata`, `@Global`, scopes | `nest g resource users`; explain every generated file; compare with the Day 5 raw server | What is DI? How does Nest resolve dependencies? |
| 9 | 10-28 | Users CRUD with Prisma: DTOs, class-validator/transformer, pipes, status codes, Prisma errors (P2002 → 409) | Full `/users` CRUD | Validation; correct HTTP codes |
| 10 | 10-29 | ★ Request lifecycle: middleware → guards → interceptors → pipes → handler → interceptors → filters | Request-id middleware, timing interceptor, global exception filter | Lifecycle order; guard vs middleware vs interceptor |
| 11 | 10-30 | Config & custom providers: `useClass/useValue/useFactory/useExisting`, tokens, dynamic modules, circular deps / `forwardRef` | Validate env at boot (fail fast) | Dynamic modules; circular dependency fixes |
| 12 | 10-31 | Testing: unit tests (`Test.createTestingModule`, mocks), e2e with supertest, test-DB strategy | Unit-test UsersService (mock Prisma), e2e-test `/users` | Unit vs integration vs e2e; mocking in Nest |
| 13 | 11-01 | REST API design: Products module, filtering/sorting DTOs, versioning, Swagger, response serialization. **DevOps:** what CI is | Products CRUD + Swagger docs. **DevOps milestone:** GitHub Actions CI runs lint + unit + e2e (Postgres service container) on every push | API design review; "What does your CI pipeline do?" |
| 14 | 11-02 | Week 2 review + Nest mock round | Code review of everything so far | Mixed Nest questions |

**Daily SQL drill (Days 1–14, ~15 min in `psql`):** D1 psql basics (`\l \dt \d`) + SELECT ·
D2 WHERE/ORDER/LIMIT · D3 INSERT/UPDATE/DELETE · D4 constraints · D5 aggregates · D6 GROUP BY/HAVING ·
D7 review · D8 INNER JOIN · D9 LEFT/RIGHT/FULL JOIN · D10 self-join · D11 subqueries ·
D12 IN vs EXISTS · D13 CASE, COALESCE, NULL semantics · D14 review.

### Week 3: Databases (11-03 → 11-09)

| Day | Date | Topic | Project / exercise | Interview focus |
|---|---|---|---|---|
| 15 | 11-03 | ★ Relational modeling: PK/FK, 1:1, 1:N, M:N, normalization (1NF–3NF), when to denormalize | Design the ShopLite ERD on paper first, then Prisma schema + migration; read the SQL it generated | Normalize this table; design a schema for X |
| 16 | 11-04 | ★ SQL fluency: joins, GROUP BY, subqueries, CTEs, window functions | Seed script (~10k rows); 10 reporting queries (revenue per category, top customers…) | Classic SQL questions (Nth highest, duplicates, running totals) |
| 17 | 11-05 | ★ Indexes & performance: B-tree, composite/leftmost prefix, covering, partial; `EXPLAIN ANALYZE` | Find a slow query, add an index via a migration, prove the speedup with EXPLAIN | How do indexes work? Why is this query slow? |
| 18 | 11-06 | ★ Transactions & ACID: isolation levels, anomalies, row locks, `SELECT … FOR UPDATE`, optimistic locking, deadlocks | `POST /orders` in `$transaction`; reproduce overselling with concurrent requests, then fix it | Inventory race condition: how do you prevent it? |
| 19 | 11-07 | ORM vs raw SQL, N+1, pagination (offset vs cursor), `$queryRaw` vs `$queryRawUnsafe` (SQL injection), connection pooling | Cursor pagination on `/products`; orders with items without N+1 | N+1; pagination at scale; SQL injection |
| 20 | 11-08 | SQL vs NoSQL, CAP, replication, sharding/partitioning; Redis basics; caching strategies and invalidation | **DevOps milestone:** `docker-compose.yml` for Postgres + Redis; cache-aside for `GET /products/:id` with invalidation | When NoSQL? Cache invalidation; image vs container |
| 21 | 11-09 | Week 3 review + DB mock: live schema design, SQL on a whiteboard, a transaction scenario | | Mixed DB questions |

### Week 4: Production backend (11-10 → 11-16)

| Day | Date | Topic | Project / exercise | Interview focus |
|---|---|---|---|---|
| 22 | 11-10 | ★ Authentication: hashing (argon2/bcrypt, why not SHA), sessions vs JWT, access + refresh tokens, httpOnly cookies | `/auth/register`, `/auth/login`, `/auth/refresh`, JWT guard | JWT vs sessions; where do you store tokens? |
| 23 | 11-11 | Authorization & security: RBAC (`@Roles`, `@CurrentUser`), OWASP API risks, helmet, CORS, rate limiting, secrets | Admin-only product writes; users see only their own orders; throttle login | How do you secure an API? |
| 24 | 11-12 | Background jobs: queues (BullMQ), retries/backoff, idempotent jobs, dead-letter queues, cron, webhooks (concept) | Order-confirmation email job (fake mailer); cron to cancel unpaid orders | Why use a queue? Exactly-once vs at-least-once |
| 25 | 11-13 | Streams in production: file upload, streaming CSV export from the DB, `worker_threads` for CPU work | `GET /orders/export.csv` streamed with `pipeline()` | "Export 1M rows without running out of memory" |
| 26 | 11-14 | Performance & observability: structured logs (pino), correlation IDs, profiling, memory leaks (heap snapshots), load testing (autocannon), cluster/PM2, statelessness | Load-test before and after caching; find a planted memory leak | How do you debug a memory leak or a slow API? |
| 27 | 11-15 | ★ **Ship it:** multi-stage Dockerfile; deploy the API to a PaaS with managed Postgres (migrations in the deploy step, secrets as env vars, health check, graceful shutdown); deploy a tiny frontend to a static host/CDN (CORS, build-time env vars); idempotency keys | **DevOps milestone:** Dockerize ShopLite; **live API URL + live frontend URL**; idempotent `POST /orders` | "Walk me from `git push` to production"; idempotency; zero-downtime deploys |
| 28 | 11-16 | ★ System design: URL shortener, rate limiter, notification system; monolith vs microservices, brokers (Kafka/RabbitMQ), API gateway, REST vs GraphQL | Whiteboard designs | Design X end to end |

### Final: Mock interviews (11-17 → 11-18)

| Day | Date | Plan |
|---|---|---|
| 29 | 11-17 | Full mock interview (60–90 min): intro, JS/Node core, Nest, DB, DevOps/deployment, live coding (async utility), system design. Scorecard → update Weak spots |
| 30 | 11-18 | Revise weak spots, short mock #2, rehearse the ShopLite pitch (including how it's built, tested and deployed), rewrite `README.md` as a portfolio README with the live URLs and CI badge |

### DevOps track (woven through the month)

Node backend interviews almost always ask "how do you deploy this?" A Node dev is expected to handle
Docker, CI/CD, deploying an API and a frontend, and basic cloud and networking. The track has two parts.
Teach it in the same easy style, and add a **DevOps** section to that day's notes file.

**Hands-on milestones (weekend-sized tasks, already in the tables above):**

| Day | Date | Milestone |
|---|---|---|
| 13 | 11-01 | **CI:** a GitHub Actions workflow runs lint + unit + e2e tests on every push |
| 20 | 11-08 | **Docker basics:** docker-compose runs Postgres + Redis locally |
| 27 | 11-15 | **Ship it:** Dockerfile, the API live on a PaaS with managed Postgres, a tiny frontend live on a static host/CDN |

**Daily DevOps bite (Days 15–28, ~10 min: one concept + one interview question):**

| Day | Bite |
|---|---|
| 15 | Linux for backend devs: processes, ports (`lsof -i :3000`), signals, env vars, logs, SSH |
| 16 | Environments & config: dev/staging/prod, the 12-factor app, secrets never in git, secret managers |
| 17 | Git in a team: feature branches, PRs, merge vs rebase, tags + semver releases, trunk-based vs GitFlow |
| 18 | Docker concepts: image vs container, layers & build cache, multi-stage builds, `.dockerignore` |
| 19 | docker-compose, volumes, networks; the "works on my machine" problem |
| 20 | CI/CD deep-dive (builds on Day 13): CI vs continuous delivery vs continuous deployment, pipeline stages, artifacts, environments & approvals |
| 21 | Networking: DNS, domains, HTTPS/TLS certificates (Let's Encrypt), ports 80/443 |
| 22 | Reverse proxy & load balancer: Nginx, TLS termination, health checks, sticky sessions |
| 23 | ★ Where to run a Node API: PaaS vs VM (PM2 + Nginx) vs containers (ECS/Kubernetes) vs serverless (Lambda), and the trade-offs |
| 24 | ★ Frontend deployment: static build, CDN, cache headers + hashed filenames, SPA fallback, build-time vs runtime env vars, CORS, SSR (Next.js) vs static |
| 25 | Cloud mental map (AWS): EC2, S3, RDS, IAM, VPC/security groups, ALB, CloudFront, CloudWatch |
| 26 | Zero-downtime deploys: rolling, blue-green, canary, rollback; safe DB migrations (expand → migrate → contract) |
| 27 | Kubernetes in 10 min: pod, deployment, service, ingress, liveness/readiness probes, autoscaling |
| 28 | Observability & security hygiene: logs/metrics/traces, alerts, uptime checks; `npm audit`, least privilege, image scanning |

**Coding warm-ups to spread through the month:** closures, `this`, prototypes, debounce/throttle,
deep clone, memoize, retry with backoff, async queue, LRU cache, flatten, implementing a Promise.

## Readiness scorecard (0–5, update weekly)

| Area | W1 | W2 | W3 | W4 | Final |
|---|---|---|---|---|---|
| JS/TS fundamentals & coding | | | | | |
| Node core (event loop, async, streams) | | | | | |
| NestJS | | | | | |
| SQL & data modeling | | | | | |
| Transactions, indexes, performance | | | | | |
| Auth & security | | | | | |
| Scaling, caching, queues, ops | | | | | |
| DevOps: Docker, CI/CD, deploying API + frontend, cloud basics | | | | | |
| System design | | | | | |

## Progress

### Weak spots (carry into recall questions)

- **Answers without the "why"** (Days 1, 3): gives a bare answer ("24, 22"; Day 3: "2. fail", "4. B") with no reason. In interviews the reason earns the marks, so keep asking "why?" until it's automatic.
- **Generic, hedged answers instead of pointing at the code** (Day 1): answered "startup if eager, first request if lazy"
  rather than reading `getOrThrow` in the constructor. Push them to commit to one answer and cite the exact line.
- **Forgets the second half of a question** (Days 1, 4): said what breaks without `@Global()`, but not the fix. 11-01 recall: R1 gave "Promise.all rejects at 10 ms" but no code and no "why safer"; R2 explained the 5 s block but gave no fix.
- **Skips the checks and moves on** (Day 3): skipped explain-backs, puzzles 4–6, the build fixes and the interview round ("continue", "aage padha"). Respect the choice, but say plainly what's skipped and open the next session with it.
- **Pastes polished, looked-up answers instead of answering from memory** (Days 1–2): Q2/Q3 of the Day 2
  interview round were clearly written text, and Q1 was skipped. Ask for rough, spoken-style answers from memory
  ("Hinglish and typos are fine"). Grade the content, but say plainly that pasted answers don't build interview skill.
  On 10-30 they asked for the answers instead of attempting (D's why, puzzle 2, recall 1–3). Answers were given
  with an explain-back check; **re-ask the same ideas in a new form next session**. 11-01: R2 read as written text and R3 was **pasted** (correct content, plus one slip: "dns.lookup is synchronous"). R4 skipped. The learner asked for all answers in the notes (done: `05-async` §10, `06-modules`).
- **Event loop details** (Day 2): put nextTick before sync code; thought microtasks drain per *phase* (that was
  Node ≤ 10); unsure about `setTimeout` vs `setImmediate` inside I/O. Re-quiz on Day 3.
- **Shell startup order** (Day 1): missed that `~/.zshrc` still runs in the non-login terminal, so whoever edits PATH last wins. Minor; not an interview topic.

### Log

| Day | Date | Done | Notes / next |
|---|---|---|---|
| 0 | 2026-10-13 | Repo-local git identity + classic-token push auth (this repo only); tutor brief written; initial commit pushed to `pkCodes30/LearningNode`; Node 24 scoped to this workspace via `.vscode/settings.json` (no global change); DevOps track added to the plan at the learner's request | Next: Day 1. Open items: the token has every scope (should be `repo` only); the repo is public (private recommended) |
| 1 | 2026-10-13 → 10-20 | PATH & LTS lesson; what Node is (V8 + libuv, waiter analogy, I/O vs CPU); `playground/day01/blocking.js`; line-by-line project tour; **decorators & DI chapter pulled forward from Day 8** (learner asked), with demos in `playground/decorators-di/`; fixed bare `nest` hitting the global v11 CLI. Notes: `01-node-basics`, `01-project-tour`, `02-decorators-and-di` | Day 1 check questions answered on 10-21 (2/5 and 3/5). **Plan shifted +7 days** (the learner chose this over compressing). Next topic: Day 2, the event loop ★ |
| 2 | 2026-10-21 → 10-27 | Event loop: queues, phases (T-P-P-C-C), N before P, 5 puzzles in `playground/day02/` (order, I/O, async/await, starvation, microtasks after each callback). Notes: `03-event-loop`. Interview round: Q1 skipped, Q2 3/5 (said microtasks drain per phase), Q3 5/5 content (looked up) | **Pace: Day 2 took ~6 calendar days, so 11-19 won't hold at this rate.** Raised re-planning with the learner. Next: Day 3, async patterns ★ (Promise.all/allSettled/race/any, promisePool) |
| — | 2026-10-27 | Learner asked for a Nest decorators reference: `notes/04-nest-decorators.md` (7 families, real outputs) + 4 compiled TS demos in `playground/nest-decorators/` (`npx tsc -p playground/nest-decorators`, output in its gitignored `dist/`). Verified traps: forgotten `@Injectable` crashes at runtime not startup; global ValidationPipe turns `?page=abc` into NaN → `DefaultValuePipe` gives 1; `@ValidateNested` without `@Type` + whitelist rejects valid fields; plain objects bypass `@Exclude` | Reference only, not yet taught; quiz from it on Days 8–10 |
| 3 | 2026-10-29 → | Reformatted every notes table (narrow + aligned). **Deadline dropped** (the learner's call): full plan at their pace, Claude maintains it. Started Day 3 (async ★): recall questions sent; chunk 1 is in `notes/05-async.md` (3 styles, sequential vs parallel, `forEach` trap, early rejection crashes the process) with demos `playground/day03/01–02` | Puzzle 1 (10-30): all 4 timings + the `C item` placement right; the "why" for D was still missing (asked). The learner then asked for the answers: gave D's why, puzzle 2, recall 1–3, plus the **ESM twist** (S N P T in `.cjs` vs S P N T in `.mjs`, added as section 9 of `03-event-loop` with `playground/day02/06-esm-twist.*`). The learner skipped the 2 explain-back questions ("continue next chapter"), so **re-ask them as recall next session** (sequential awaits → `Promise.all`; `.cjs` order D C B A). Chunk 2 taught (10-30): the 4 combinators, "all fails ≠ others stop" (no cancellation → transaction), `withTimeout` via `race` + the `clearTimeout` trap; notes sections 4–6, demos `playground/day03/03–05`. Puzzle 3 (10-30): cases 2, 4, 5, 6 right on pass/fail but bare (no ms, no "why", said "B" not "rejects with B"); case 3 **order wrong** (C, B, A; it's input order A, B, C); case 1 + puzzle 4 skipped. Puzzle 4: saw that the saves still print after the request ends (the key idea), but missed the `caught` line, said chargeCard prints, and swapped order/invoice; the "why it's a bug" was skipped. Order question: right (no why). Chunk 3 taught (10-30): hidden blockers (…Sync, big JSON, ReDoS), thread pool (what uses it, 2 waves, a file read stuck behind hashes, `UV_THREADPOOL_SIZE`); notes sections 7–8, demos `06-heartbeat`, `07-thread-pool`. Puzzles 5–6 skipped ("continue"), so **ask them in the interview round**. Build started (10-30): stub `playground/day03/promise-utils.js` (learner writes the bodies) + 11 tests in `promise-utils.test.js` (`node --test`), checked against a correct version and 4 wrong ones (sequential, no empty check, batching, start-all); spec in notes section 9. Build v1 (10-30): both written, 11/11 pass; looks polished, so **the explain-back is the ownership check**. Review: dead `throw` after `return`; `!Array.isArray → resolve([])` silently turns a Set into [] and undefined into [] (the real one throws TypeError); `limit` 0 hangs; `isRejected` redundant in promiseAll (a promise settles once). Added 4 edge tests (15 total, v1 = 12/15; a fixed reference passes 15/15). Then the learner said "aage padha": **Day 3 closed without** the fixes, explain-back, puzzles 4–6 or the interview round, so these open Day 4 as recall. On 10-30 committed + pushed all Day 2–3 notes, demos and the decorators reference. |
| 4 | 2026-10-30 → 11-01 → | Modules ★. Chunk 1: CJS vs ESM table, the module wrapper (5 params, `this` = exports; real `require('node:module').wrapper`), the require cache (runs once, singleton, `{ count }` copy trap, deleting the cache). Notes: `06-modules` sections 1–3; demos `playground/day04/01-wrapper.{cjs,mjs}`, `02-cache/` | Puzzles 1–2 (11-01): every value right (`function`, `string`, 5, true; 📦 once, true, 2, **0**: caught the copy trap), but no "why" again and the `.mjs` half skipped. 11-01 session opened with recall: Day 3 re-asks (parallel + safe, hashSync blocking, which APIs use the pool) + the Day 4 whys. Weekend task: build fixes to 15/15 + 2 explain-backs. Recall graded (11-01): R1 2/5, R2 3/5, R3 content 5/5 but pasted, R4 skipped; answers written into the notes at the learner's request. Committed + pushed 5 commits (d20e9fa..cd67781), then the learner's `src/app.service.ts` edit at their request (af45897): **unit + e2e tests now fail** (they expect "Hello World!" in `src/app.controller.spec.ts:19` and `test/app.e2e-spec.ts:23`); asked whether to update the tests. Day 3 interview round moved to the Day 7 mini mock. Learner skipped the tests question ("aage padhao, jaldi"), so tests are still red. Chunk 2 taught (11-01): import hoisting (env set on line 1 is `undefined` in an imported ESM module; fix = import the env loader first, like `prisma7.config.ts`), live bindings (2 + `TypeError` on reassign), the CJS vs ESM table + spoken answer; notes §4–5, demos `03-import-order/`, `04-live-bindings/`. Learner skipped puzzles 3–4 and asked "Nest kab shuru hoga?" (11-01). Chunk 3 taught compactly: ESM never guesses `.js` (ERR_MODULE_NOT_FOUND; why `src/` uses `.js` with nodenext), TLA (importer waits), `require(esm)` on Node 24 (works; ERR_REQUIRE_ASYNC_MODULE with TLA), semver (`~` patch, `^` minor, ^0.x trap; demo via node_modules/semver), package.json fields, lockfile (541 pkgs) + `npm ci`; notes §6–7. **process/env/exit codes/signals moved to Day 7.** Day 4 build counted as covered by puzzles 2 + 4. Gave the learner the choice: keep Days 5–7 before Nest (recommended) or start Nest now. The learner chose **B: Nest now**, and asked for full explanations + Q&A in the notes instead of answering the interview round: added Revision Q&A (`05-async` §11 with tested reference `promiseAll`/`promisePool`, 15/15 ×3; `06-modules` §8). **Day 4 closed (11-01).** |
| 8 | 2026-11-01 → | ★ Nest week starts (order changed). Notes `07-nest-first-resource`: new plan map, Step 0 (learner fixes the 2 greeting tests), Step 1 (learner runs `npx nest g resource users --type rest --crud`, then changes `mapped-types` `*` → `^12.0.0`), puzzle on the generated API (`/users/abc` → `#NaN` 200; empty DTO + forbidNonWhitelisted → 400 "property email should not exist"), real outputs from a trial run on a scratch copy (port 3917, stopped after) | 11-01: the learner said "start now, put the puzzle answers in the notes, big explanatory notes", so **Claude did steps 0–1**: updated the 2 greeting test expectations (unit 1/1, e2e 2/2), ran the generator in the real repo, changed `mapped-types` `*` → `^12.0.0` + `npm install`. After: build ✅, unit 3/3, e2e 2/2, lint 2 warnings (unused DTO params in the generated service). Demos `playground/day08/`: `01-metadata.mjs` (reads @Module/design:paramtypes/path/method from dist), `02-raw-users.mjs` (same API on node:http), `03-module-exports.ts` (compiled; real "can't resolve dependencies of the OrdersService (?)" error; singleton = 1 object). Real app run on port 3918 (strings → text/html, bad JSON → 400, unknown route → 404; stopped after). Notes `07` rewritten big: building blocks, every generated file, the DI startup steps, both puzzles answered in `<details>`, Nest vs raw table, Day 9 preview, 7 revision Q&As, 9 traps. No predictions or answers from the learner yet. Next: Day 9 spec + tests; **the learner writes the CRUD**. Scratch copy `scratchpad/gen-test` left in place (the safety check blocked `rm -rf`) |
| 9 | 2026-11-02 → | Users CRUD with Prisma (learner said "continue"; Day 8 closed with no learner answers). Probed Prisma 7 + adapter-pg errors on the real DB: dup → P2002, update/delete missing → P2025, `findUnique` missing → null, Int overflow → P2020. Wrote `test/users.e2e-spec.ts` (15 acceptance tests: part 1 create+read ×9, part 2 update+delete ×6; adds the main.ts ValidationPipe because `createNestApplication()` skips main.ts; part 2 seeds via Prisma; cleans `e2e-%` users). Verified against a reference solution in the scratch copy: 17/17, `-t "part 1"` = 9, cleanup leaves 0 rows; `return` without `await` → 500 instead of 409 (real). Added `{ provide: PrismaService, useValue: {} }` to both generated unit specs (real DI error captured first). Notes `08-users-crud-prisma` (status codes, class-validator, ParseIntPipe, exceptions, Prisma error table, return-await trap, test gotchas, build spec + 6 nudge questions, 7 Q&As, traps) | Learner's starting point: e2e 13 failed / 4 passed (2 pass by accident). Waiting for: 3 Day 8 recall answers + **part 1 code** (create/findAll/findOne). Part 2 next session. Commit still not agreed (asked: commit the scaffold before editing `src/users`) |
