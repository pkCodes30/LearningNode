# 11 · Testing: unit, e2e and the test database (Day 12)

> **The whole chapter in one line:**
> **Unit tests** check your logic fast by faking everything around it; **e2e tests** check the real app over real HTTP
> with a real database. You need both, because **a mock only knows what you told it**, so it can stay green
> while the real thing is broken.

Commands:
```bash
npm test                 # unit tests: *.spec.ts (no database needed)
npm run test:e2e         # e2e tests: test/*.e2e-spec.ts (uses the separate test database)
npm run test:cov         # unit tests + a coverage report
```

---

## 🔁 Recall first (try from memory, then open)

**R1.** Two independent calls: `await getUser(id); await getOrders(id);` take 200 ms. How do you make it ~100 ms, and
why is that safer than starting both and then awaiting one by one?
<details><summary>✅ Answer</summary>

`const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);`. Both start together, so it takes as long
as the slowest. It's safer because `Promise.all` puts a handler on **every** promise at once. If you start both and
`await` them one by one, an early failure of the second has no handler yet → unhandled rejection → the process crashes.
</details>

**R2.** Put these in order: pipe, guard, middleware, handler, interceptor. Which one runs twice?
<details><summary>✅ Answer</summary>

Middleware → guard → interceptor (before) → pipe → handler → interceptor (after). The interceptor wraps the handler,
so it has a "before" and an "after" part. If anything throws, an exception filter writes the error response.
</details>

**R3.** `update()` in `UsersService` has no check for a missing user, yet a missing id gives 404. Where does it come from?
<details><summary>✅ Answer</summary>

Prisma's `update` throws `PrismaClientKnownRequestError` with code **P2025**. Our global `PrismaExceptionFilter`
(`@Catch` + `APP_FILTER`) turns it into a `NotFoundException`, so the client gets 404.
</details>

**R4.** Why does a bad `.env` stop the app at startup instead of on the first request?
<details><summary>✅ Answer</summary>

`ConfigModule.forRoot({ validate: validateEnv })` runs `validateEnv` once while the app is being created. It throws, so
`NestFactory.create` fails and the process exits with code 1, before any port is opened.
</details>

---

## 1. The three levels 🚗

🧠 **Memory hook: testing a car**

| Level           | Car version               | In ShopLite                              |
|-----------------|---------------------------|------------------------------------------|
| **Unit**        | test one part on a bench  | `UsersService` with a fake Prisma        |
| **Integration** | engine + gearbox together | a service with a real DB, no HTTP        |
| **e2e**         | drive it on a real road   | HTTP → pipes → service → Postgres → JSON |

Real numbers from this repo:

| Run                | Tests | Time       | Needs a DB? |
|--------------------|-------|------------|-------------|
| `npm test`         | 21    | ~0.5–0.8 s | no          |
| `npm run test:e2e` | 26    | ~2–4.5 s   | yes         |

- **The test pyramid:** many fast unit tests at the bottom, fewer slower e2e tests on top. Unit tests give quick
  feedback; e2e tests give confidence. (Here the counts are close because `/users` is simple CRUD with little logic.)
- **e2e** = end-to-end: the request goes through the whole app, the way a real client's would.

## 2. Mock, stub, fake, spy 🎭

These words get mixed up, and interviewers do ask. Simple si baat:

| Word | Means                                      | Our example                           |
|------|--------------------------------------------|---------------------------------------|
| Stub | a stand-in with a canned answer            | `findUnique.mockResolvedValue(asha)`  |
| Mock | a stand-in that also **records its calls** | `toHaveBeenCalledWith(…)`             |
| Fake | a simple working substitute                | an in-memory users array              |
| Spy  | watches a **real** function                | `vi.spyOn(Logger.prototype, 'error')` |

Vitest's tools (the same idea as Jest):

| Tool                                 | Does                                                   |
|--------------------------------------|--------------------------------------------------------|
| `vi.fn()`                            | creates a fake function that records its calls         |
| `.mockResolvedValue(x)`              | it returns a promise that **resolves** to `x`          |
| `.mockRejectedValue(err)`            | it returns a promise that **rejects** with `err`       |
| `expect(fn).toHaveBeenCalledWith(…)` | it was called with exactly these arguments             |
| `vi.resetAllMocks()`                 | forget all calls and answers (run it before each test) |

## 3. A Nest unit test, line by line 🔬

From `src/users/users.service.spec.ts` (the file itself has more comments):
```ts
const prismaMock = {
  user: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
};

beforeEach(async () => {
  vi.resetAllMocks();                                         // tests must not affect each other
  const module = await Test.createTestingModule({             // a mini Nest app with only what we list
    providers: [UsersService, { provide: PrismaService, useValue: prismaMock }],   // ← the swap
  }).compile();
  service = module.get(UsersService);
});

it('throws NotFoundException when the database finds nothing', async () => {
  prismaMock.user.findUnique.mockResolvedValue(null);         // ARRANGE: what "the database" answers
  await expect(service.findOne(99)).rejects.toThrow(NotFoundException);   // ACT + ASSERT
});
```
- **This is DI's real superpower.** `UsersService` never does `new PrismaClient()`; it just asks for a `PrismaService`.
  So a test can hand it anything with the same shape. `useValue` is the recipe from `notes/10` §2.
- **AAA:** **A**rrange (set up), **A**ct (call the method), **A**ssert (check). Every test has this shape.
- **`.rejects` / `.resolves`:** wait for the promise, then check how it ended. Forget `await` on them and the test
  can pass without checking anything.
- **No dependencies? No testing module.** The filter and interceptor have none, so their specs just use `new`.

### Testing the other pieces

**Exception filter** (`prisma-exception.filter.spec.ts`): fake only what it touches:
```ts
const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };   // mockReturnThis → .status().json() chains
const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;

filter.catch(new Prisma.PrismaClientKnownRequestError('…', { code: 'P2002', clientVersion: 'test' }), host);
expect(response.status).toHaveBeenCalledWith(409);
```
**Interceptor** (`timing.interceptor.spec.ts`): fake `next` with an RxJS Observable:
```ts
const next = { handle: () => of({ id: 1 }) };          // of(x): "a handler that worked and returned x"
const result = await lastValueFrom(interceptor.intercept(context, next));   // lastValueFrom: Observable → promise
expect(response.setHeader).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/^\d+ms$/));
```
`throwError(() => failure)` is "a handler that failed": the second test proves no header is added, because `tap` only
runs on success.

### What's worth a unit test?

- ✅ **Decisions:** `findOne`'s `null` → 404, the filter's code → status mapping, env validation rules.
- ✅ **"Did it ask correctly?"**: `findMany` was called with `orderBy`.
- ⚠️ **Pass-through code:** the controller only forwards values. 2 small tests are enough; e2e proves the rest.
- ❌ **The framework itself:** don't test that `@Get()` routes or that Prisma saves rows. In a unit test you can't anyway.

## 4. 🤔 Puzzle: a mock can lie

We broke the real `src/users/users.service.ts` in two ways (and restored it afterwards).

**Bug 1:** remove the `null` check from `findOne`:
```ts
const user = await this.prisma.user.findUnique({ where: { id } });
return user as User;      // no 404 anymore
```
**Bug 2:** remove one word from `remove()`:
```ts
this.prisma.user.delete({ where: { id } });      // was: await this.prisma.user.delete(…)
```
**Predict** for each bug: do the **unit** tests fail? Do the **e2e** tests fail? (Hint for Bug 2: `notes/08` §8,
Prisma queries are lazy.)

<details><summary>👀 Real output + why</summary>

```
=== BUG 1: no null check → unit tests:
  × throws NotFoundException when the database finds nothing
  AssertionError: promise resolved "null" instead of rejecting
  Tests  1 failed | 5 passed | 1 todo (7)

=== BUG 2: no await in remove() → unit tests:
  Tests  8 passed | 1 todo (9)                   ← 😱 ALL GREEN

=== BUG 2 → e2e tests:
  × turns a Prisma P2025 (record not found) into 404 instead of 500
  × DELETE /users/:id → 204 with an empty body, then GET → 404
  × DELETE /users/999999999 → 404
  Error: expected 404 "Not Found", got 204 "No Content"
  Error: expected 404 "Not Found", got 200 "OK"
```
- **Bug 1 is a logic bug.** The logic lives in our code, so the unit test catches it.
- **Bug 2 is an integration bug.** Our mock's `delete` is a plain `vi.fn()`: it records the call, and the test sees
  "called with the right arguments" ✅. But a **real** Prisma query only runs when awaited, and now nobody awaits it.
  So `DELETE` answers 204 **and the user is still there** (`got 200 "OK"` on the GET afterwards).
- 🧠 **The lesson:** a mock tests your code against **your belief** about the dependency. If the belief is wrong or
  incomplete, the mock is too. That's why you need e2e tests on top: they test against the real thing.
- **Try it yourself (2 min):** delete that `await`, run `npm test` and `npm run test:e2e`, then restore the file with
  `git checkout -- src/users/users.service.ts`.
</details>

## 5. e2e tests: the real app over HTTP 🌐

From `test/users.e2e-spec.ts`:
```ts
const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();  // the WHOLE app
app = moduleFixture.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ … }));       // main.ts doesn't run in tests (notes/09 §3)
await app.init();

const res = await request(app.getHttpServer())       // supertest: sends real HTTP, no port needed
  .post('/users').send({ email, name: 'Asha' }).expect(201);
expect(res.body).toMatchObject({ email, name: 'Asha' });
```
- **supertest** sends real HTTP requests to the app, through the whole lifecycle: middleware, pipes, filters.
- Test what a **client** sees: status codes, JSON, headers. Not internal details.

### `overrideProvider`: the real app, with one piece swapped

How do you test "the database is down"? You can't easily stop Postgres in a test. So, from `test/database.e2e-spec.ts`:
```ts
const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PrismaService)
  .useValue({ $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')) })
  .compile();
…
const res = await request(app.getHttpServer()).get('/health').expect(500);
expect(res.body).toEqual({ statusCode: 500, message: 'Internal server error' });
```
- That test passes: the error text `connection refused` does **not** leak to the client.
- `overrideProvider` is perfect for slow or unreliable outside services too: a payment API, a mailer.
- (A health check is better answering **503 Service Unavailable** than 500. We'll improve that on Day 27.)

## 6. The test database 🗄️

### The problem we had

Until today, `npm run test:e2e` ran against `learning_node`, your **dev** database. Dangerous:
- Tests create and delete rows **in the same tables you use while developing**.
- A crashed run leaves junk rows behind, and those can make the next run fail.
- CI (Day 13) needs a database it can freely wipe.

### The options

| Strategy                        | Good                  | Bad                             |
|---------------------------------|-----------------------|---------------------------------|
| **Separate test DB** ✅ (ours)  | real Postgres, simple | shared, so data must not clash  |
| Testcontainers (a DB per run)   | perfectly isolated    | needs Docker; slower to start   |
| Rollback a transaction per test | very fast cleanup     | hard over HTTP (own connection) |
| In-memory / SQLite instead      | no setup              | ❌ not Postgres; can hide bugs  |

### What we built

**`vitest.config.e2e.ts`** derives the test URL from the normal one, changing only the name:
```ts
const url = new URL(process.env.DATABASE_URL);
if (!url.pathname.endsWith('_test')) url.pathname += '_test';   // learning_node → learning_node_test
…
env: { DATABASE_URL: url.toString() },          // the real env beats .env (notes/10 §6.3): the app needs no change
globalSetup: ['./test/global-setup.ts'],        // runs once, before all test files
```
**`test/global-setup.ts`** does 3 things:
1. **Safety check:** refuses to continue unless the database name ends in `_test`.
2. **`prisma migrate deploy`:** creates the database if needed and applies the migrations.
3. **`TRUNCATE` every table** (except `_prisma_migrations`), so each run starts empty.

Real output:
```
--- databases:
learning_node
learning_node_test                 ← created automatically on the first run

=== guard: config wrongly pointing at the DEV database:
Error: Refusing to reset "learning_node": not a test database

=== cleanup: plant a leftover row in the test DB, then run
before run: 1 row(s)
      Tests  26 passed (26)
after run : 0 row(s)
```
- **Test files run in parallel** on one database, so we can't `TRUNCATE` per test: it would delete another file's rows.
  That's why each test makes **unique emails** (`e2e-asha-1730…@shop.dev`) and never assumes the table is empty.
- `database.e2e-spec.ts` asks Postgres directly (`SELECT current_database()`) and checks that the name ends in `_test`.
- No new setting or secret was needed: the same setup will work in CI on Day 13.

## 7. Coverage 📊

`npm run test:cov` shows which lines the tests ran. Real output (unit tests only, trimmed):
```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   87.12 |    68.42 |   65.51 |   87.12 |
users.service.ts   |    90.9 |       75 |   83.33 |    90.9 | 65
```
- Line 65 of the service is the `update` method: that's your drill below.
- **Coverage shows what you did NOT test. It doesn't prove what you DID test.** Bug 2's `delete` line still **runs**
  with the mock, so it counts as covered, while the feature is broken.
- So don't chase 100%. A sensible answer is: *"high coverage on business logic, plus e2e tests on the critical flows."*

## 8. Two more ideas interviewers like

- **Flaky test** = passes sometimes, fails sometimes, with no code change. Usual causes: tests sharing data, real
  timers, relying on order. A flaky test is worse than none, because people stop trusting the whole suite.
- **`beforeAll` vs `beforeEach`:** use `beforeEach` for cheap setup that must be fresh (mocks). Use `beforeAll` for
  expensive setup (booting the Nest app in e2e).

## 9. ✍️ Drill: write one test yourself (5 min)

Reading tests isn't writing tests, and interviews do ask you to write one live.
In `src/users/users.service.spec.ts`, replace the `it.todo(…)` line with a real test for `update`.

**It should check:** the service returns what Prisma returned, and calls `prisma.user.update` with
`{ where: { id: 1 }, data: { name: 'Asha K' } }`. It has the same shape as the `create` test just above it.
**Done =** `npm test` shows **22 passed**, with no more `todo`.

<details><summary>✅ Answer (tested: it passes)</summary>

```ts
it('passes the id and the DTO to prisma.user.update', async () => {
  const updated = { ...asha, name: 'Asha K' };
  prismaMock.user.update.mockResolvedValue(updated);

  await expect(service.update(1, { name: 'Asha K' })).resolves.toEqual(updated);
  expect(prismaMock.user.update).toHaveBeenCalledWith({
    where: { id: 1 },
    data: { name: 'Asha K' },
  });
});
```
</details>

## 10. 📝 Revision Q&A: Day 12 interview questions

**Say your answer out loud first**, then open the box.

**Q1. ★ Unit vs integration vs e2e?**
<details><summary>✅ Answer</summary>

A unit test checks one class alone, with its dependencies mocked: very fast, and it pinpoints logic bugs. An
integration test checks a few real pieces together, like a service with a real database. An e2e test goes through
the whole app over HTTP with a real database, as a client would: slower, but it catches what mocks can't. I use many
unit tests for business logic and fewer e2e tests for the critical flows. In my project, removing one `await` left all
the unit tests green while `DELETE` stopped deleting; only the e2e tests caught it.
</details>

**Q2. ★ How do you mock dependencies in Nest?**
<details><summary>✅ Answer</summary>

Through DI. `Test.createTestingModule` builds a mini module, and I swap the dependency with a custom provider:
`{ provide: PrismaService, useValue: prismaMock }`, where the mock's methods are `vi.fn()` (or `jest.fn()`). The class
under test doesn't change, because it only asks for a token. In e2e tests I use `.overrideProvider(X).useValue(...)`
to keep the whole real app and swap one piece, for example to simulate a database outage.
</details>

**Q3. Mock vs stub vs spy?**
<details><summary>✅ Answer</summary>

A stub returns canned answers. A mock also records how it was called, so the test can check the interaction. A fake
is a simple working substitute, like an in-memory repository. A spy wraps a real function to watch it. In practice,
`vi.fn()` covers stubs and mocks, and `vi.spyOn` gives you a spy.
</details>

**Q4. ★ How do you manage the database in e2e tests?**
<details><summary>✅ Answer</summary>

A separate test database, never the dev one. In my project the test URL is derived from `DATABASE_URL` by adding
`_test`. A global setup runs once: it refuses to continue unless the name ends in `_test`, runs `prisma migrate
deploy` so the schema matches production, and truncates all tables. Test files run in parallel on it, so tests create
unique data instead of assuming an empty table. If Docker is available, Testcontainers gives even better isolation.
I wouldn't use SQLite or an in-memory database, because it isn't Postgres and can hide real bugs.
</details>

**Q5. What coverage do you aim for?**
<details><summary>✅ Answer</summary>

There's no magic number. I want high coverage on business logic and e2e tests on critical flows. Coverage shows what
wasn't tested, but it doesn't prove that what ran was checked properly: a line can run with a mock while the real
feature is broken. So I treat it as a flashlight for finding gaps, not as a target.
</details>

**Q6. What makes a test flaky, and how do you fix it?**
<details><summary>✅ Answer</summary>

A flaky test passes and fails with no code change. Common causes are tests sharing data, dependence on run order, real
time and timers, and real network calls. Fixes: unique data per test, resetting mocks in `beforeEach`, fake timers, and
mocking outside services. I fix or remove flaky tests quickly, because otherwise people stop trusting the suite.
</details>

---

## ⚠️ Interview traps

| They say…                               | You say…                                              |
|-----------------------------------------|-------------------------------------------------------|
| "Green unit tests mean it works."       | A mock only knows what you told it. You need e2e too  |
| "100% coverage means no bugs."          | It shows what ran, not what was checked               |
| "Run e2e tests on the dev database."    | A separate test DB, with a name check before wiping   |
| "Use SQLite in tests, it's faster."     | Not Postgres, so it can hide real bugs                |
| "Test private methods directly."        | Test behaviour through the public methods             |
| "Reuse one row across tests."           | Unique data per test; files run in parallel           |
| "`expect(p).rejects…` without `await`." | The test can pass without checking. Always `await` it |
