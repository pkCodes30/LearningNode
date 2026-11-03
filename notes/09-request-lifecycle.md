# 09 · The request lifecycle ★ (Day 10)

> **The whole chapter in one line:**
> Every request walks the same path: **middleware → guards → interceptors (before) → pipes → handler →
> interceptors (after)**, and if anything throws on the way, an **exception filter** writes the error response.
> Knowing *which* piece runs *when* tells you where each job belongs.

Demo:
```bash
npx tsc -p playground/day10 && node playground/day10/dist/01-lifecycle.js
```

---

## 1. The five pieces ✈️

🧠 **Memory hook: catching a flight**

| Piece           | Airport version                 | Its job in Nest                        |
|-----------------|---------------------------------|----------------------------------------|
| **Middleware**  | the entrance door: everyone     | raw `req`/`res`: logging, request id   |
| **Guard**       | security: "can you fly?"        | **yes/no**: auth, roles. `false` → 403 |
| **Interceptor** | your escort, **before + after** | wrap the handler: timing, caching      |
| **Pipe**        | bag check: inspect + repack     | **validate / transform** arguments     |
| **Handler**     | the gate + the plane            | your controller method                 |
| **Filter**      | help desk when it goes wrong    | exception → the error **response**     |

What each one can "see":

| Piece       | Knows the handler?        | Can change the response? | Tools                    |
|-------------|---------------------------|--------------------------|--------------------------|
| Middleware  | ❌ runs before routing    | only by hand (`res`)     | `req`, `res`, `next()`   |
| Guard       | ✅ `ExecutionContext`     | no, only allow/deny      | `canActivate()`          |
| Interceptor | ✅                        | ✅ map the result        | `next.handle()` + RxJS   |
| Pipe        | ✅ one argument at a time | no, only the argument    | `transform(value)`       |
| Filter      | ✅                        | ✅ writes the error      | `catch(exception, host)` |

- **`ExecutionContext`** = an object that tells guards and interceptors **which** controller and method will run,
  so they can read decorators on it (like `@Roles('admin')`, Day 23). Middleware runs too early to know that.
- 🧅 **Interceptors are like an onion:** code before `next.handle()` runs on the way **in**, code in `.pipe(…)` runs
  on the way **out**. That's why one interceptor can time a request (start the clock before, stop it after).

## 2. 🤔 Puzzle: who runs, and who gets skipped?

Every piece in `playground/day10/01-lifecycle.ts` logs a numbered line when it runs. The important bits:
```ts
guard:        returns false when ?deny=1                    → "2. guard → allow / DENY"
interceptor:  log before; next.handle().pipe(tap(log after)) → "3. … (before)" / "6. … (after)"
pipe:         Number(value); NaN → BadRequestException      → "4. pipe ('…')"
handler:      throws new Error('handler blew up') if ?fail=1 → "5. handler (id = …)"
filter:       @Catch() everything, sends the status          → "7. exception filter (status)"
```
**Predict** the log lines and the status code for each request:
1. `GET /demo/5`
2. `GET /demo/5?deny=1`
3. `GET /demo/abc`
4. `GET /demo/5?fail=1`

<details><summary>👀 Real output + why</summary>

```
GET /demo/5
   1. middleware
   2. guard → allow
   3. interceptor (before)
   4. pipe ('5')
   5. handler (id = 5)
   6. interceptor (after)
   → 200 {"id":5}
GET /demo/5?deny=1
   1. middleware
   2. guard → DENY
   7. exception filter (403)
   → 403 {"statusCode":403,"message":"Forbidden resource"}
GET /demo/abc
   1. middleware
   2. guard → allow
   3. interceptor (before)
   4. pipe ('abc')
   7. exception filter (400)
   → 400 {"statusCode":400,"message":"id must be a number"}
GET /demo/5?fail=1
   1. middleware
   2. guard → allow
   3. interceptor (before)
   4. pipe ('5')
   5. handler (id = 5)
   7. exception filter (500)
   → 500 {"statusCode":500,"message":"handler blew up"}
```
1. **Happy path:** the full order, 1 → 6. Note the interceptor runs **before the pipe**: pipes run right before
   the handler, because they work on the handler's arguments.
2. **Guard says no:** Nest throws `ForbiddenException` ("Forbidden resource") → **403**. The interceptor, pipe and
   handler **never run**. That's why auth belongs in a guard: nothing behind it is even touched.
3. **Pipe fails:** the interceptor's *before* part already ran, but the handler didn't, and the *after* part
   (`tap`) didn't either: `tap` only runs on **success**. The filter answers 400.
4. **Handler throws a plain `Error`:** again no *after* line. Not an `HttpException`, so → **500**.
- ⚠️ This demo filter sends `exception.message` for the 500, so it **leaks** "handler blew up" to the client. A real
  filter must send a generic `"Internal server error"` for unknown errors and only **log** the details.
- The middleware ran first every time, even for the denied request: it doesn't know or care about the route's rules.
</details>

## 3. Where you can attach each piece 📍

| Piece       | Global (in `AppModule`)               | One controller / one route           |
|-------------|---------------------------------------|--------------------------------------|
| Middleware  | `consumer.apply(M).forRoutes('*')`    | `.forRoutes(UsersController)`        |
| Guard       | `{ provide: APP_GUARD, useClass: G }` | `@UseGuards(G)`                      |
| Interceptor | `APP_INTERCEPTOR`                     | `@UseInterceptors(I)`                |
| Pipe        | `APP_PIPE`                            | `@UsePipes(P)`, or `@Param('id', P)` |
| Filter      | `APP_FILTER`                          | `@UseFilters(F)`                     |

- `@Use…()` on the **class** = the whole controller; on a **method** = that one route.
- Each `APP_*` also has a `main.ts` form: `app.useGlobalGuards()`, `useGlobalInterceptors()`, `useGlobalPipes()`,
  `useGlobalFilters()`, and `app.use()` for middleware.
- `forRoutes('*')` was checked on Nest 12 (Express 5): it matches every route, with no warning.

- **`APP_PIPE`, `APP_FILTER`, … (a provider in `AppModule`)** vs **`app.useGlobal…()` in `main.ts`:** the provider way
  is part of the module, so the **e2e tests get it automatically** and it can use DI. The `main.ts` way is skipped by
  `createNestApplication()`. That's exactly why `test/users.e2e-spec.ts` had to add the `ValidationPipe` by hand.
- **Order within one kind:** global → controller → route. **Filters are the exception:** the closest one wins
  (route → controller → global).

## 4. ✅ Day 10 build: done (11-03, written by Claude at the learner's request, with line-by-line comments)

New files live in `src/common/`; the wiring is in `src/app.module.ts`.

| File                                  | Piece            | What it does                          |
|---------------------------------------|------------------|---------------------------------------|
| `middleware/request-id.middleware.ts` | middleware       | `x-request-id` on every response      |
| `interceptors/timing.interceptor.ts`  | interceptor      | `X-Response-Time: 12ms` on success    |
| `filters/prisma-exception.filter.ts`  | exception filter | P2002 → 409, P2025 → 404, other → 500 |

How they're attached (in `AppModule`, so the e2e tests get them too):
```ts
providers: [
  AppService,
  { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
],
…
configure(consumer: MiddlewareConsumer): void {
  consumer.apply(RequestIdMiddleware).forRoutes('*');
}
```
The 3 key ideas, in one line each:
- **Middleware:** `const requestId = incomingId && incomingId.length <= 100 ? incomingId : randomUUID();`
  then `res.setHeader('x-request-id', requestId); next();` (forget `next()` and the request hangs).
- **Interceptor:** start `performance.now()` **before** `next.handle()`, set the header inside `tap()` **after**.
- **Filter:** `@Catch(Prisma.PrismaClientKnownRequestError)` + a `switch` on `exception.code`. Unknown codes are
  **logged** and answered with a generic 500 (never the raw Prisma message).

Real output (your dev server, after the change):
```
$ curl -i localhost:3000/health
HTTP/1.1 200 OK
x-request-id: 833322de-9af4-4d52-a3f4-a27ed8de6def
X-Response-Time: 26ms
{"status":"ok","database":"up"}

$ curl -i -H 'x-request-id: trace-abc-123' localhost:3000/users/abc
HTTP/1.1 400 Bad Request
x-request-id: trace-abc-123
{"message":"Validation failed (numeric string is expected)","error":"Bad Request","statusCode":400}
```
- The 400 has the request id (middleware runs **first**, before the pipe fails) but **no** `X-Response-Time`
  (the interceptor's `tap` runs only on **success**). That's the section 2 puzzle, in the real app.
- Tests: `test/lifecycle.e2e-spec.ts` (7 tests) → all pass; all e2e: **24 passed (24)**.

🗣️ **Explain back (answer in your own words):**
1. Why is the request id set in a **middleware**, but the timing done in an **interceptor**?
2. Why are the filter and interceptor registered with `APP_FILTER` / `APP_INTERCEPTOR` and not in `main.ts`?
3. Why does the filter send a generic 500 for unknown Prisma codes instead of `exception.message`?

## 5. 📝 Revision Q&A: Day 10 interview questions

**Say your answer out loud first**, then open the box.

**Q1. ★ What is the order of the Nest request lifecycle?**
<details><summary>✅ Answer</summary>

Middleware first, then guards, then interceptors (the part before `next.handle()`), then pipes, then the route
handler, then interceptors again on the way out. If anything throws along the way, exception filters catch it and
build the error response. Within guards, interceptors and pipes, global ones run before controller-level ones, which
run before route-level ones; for filters the most specific one wins. In our demo, a guard returning false skipped the
interceptor, pipe and handler completely and went straight to the filter with a 403.
</details>

**Q2. ★ Guard vs middleware vs interceptor: when do you use which?**
<details><summary>✅ Answer</summary>

**Middleware** runs first, before Nest knows which handler will run, so it's for generic request work: logging, a
request id, CORS, body parsing. **Guards** decide yes or no: authentication and authorization. They get an
`ExecutionContext`, so they can read metadata like `@Roles('admin')` on the handler, and a `false` becomes a 403.
**Interceptors** wrap the handler, before and after, so they're for timing, caching, transforming the response, or
mapping errors. Rule of thumb: allow/deny → guard; touch every raw request → middleware; around the handler →
interceptor; validate or convert input → pipe; shape errors → filter.
</details>

**Q3. Why do pipes run after interceptors, right before the handler?**
<details><summary>✅ Answer</summary>

Because pipes work on the handler's **arguments**: they validate or transform each `@Body()`, `@Param()` or
`@Query()` value just before the method is called with them. Interceptors wrap the whole call, so they start
earlier and end later.
</details>

**Q4. What is an exception filter, and why write your own?**
<details><summary>✅ Answer</summary>

A filter catches exceptions thrown anywhere in the lifecycle (guards, pipes, handlers, interceptors) and turns them
into the HTTP response. Nest's built-in filter handles `HttpException`s and sends a generic 500 for anything else.
You write your own to map other errors in one place, for example Prisma's P2002 to 409 and P2025 to 404, to give
every error the same JSON shape, or to log errors with a request id. It must never leak internal messages for 500s.
</details>

**Q5. `app.useGlobalPipes()` in `main.ts` vs `APP_PIPE` in a module?**
<details><summary>✅ Answer</summary>

Both make the pipe global. `useGlobalPipes` lives in `main.ts`, outside the module system, so it can't use
dependency injection and it isn't applied when tests create the app with `Test.createTestingModule`.
`{ provide: APP_PIPE, useValue: new ValidationPipe(...) }` in `AppModule` is part of the module, so tests get it
automatically, and with `useClass` it can inject other providers. The same goes for `APP_GUARD`, `APP_INTERCEPTOR`
and `APP_FILTER`.
</details>

---

## ⚠️ Interview traps

| They say…                                     | You say…                                        |
|-----------------------------------------------|-------------------------------------------------|
| "Pipes run before guards."                    | Guards first. Pipes run just before the handler |
| "Middleware can read `@Roles()`."             | It runs before routing. Use a guard             |
| "If the guard fails, the handler still runs." | No: `false` → 403, nothing after it runs        |
| "`tap` in an interceptor runs on errors."     | Only on success. Use `catchError` for errors    |
| "Send `error.message` for 500s."              | Never leak internals: generic message + log     |
| "`useGlobalPipes` applies in e2e tests too."  | Not with `createNestApplication()`: `APP_PIPE`  |
