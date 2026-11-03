# 08 · Users CRUD with Prisma (Day 9)

> **The whole chapter in one line:**
> The **DTO + pipes** reject bad input with a **400** before your code runs; the **service** talks to the DB through
> Prisma and turns DB problems into the right HTTP answer (**404** not found, **409** duplicate); the **controller**
> just connects the URL to the service.

Tests for this chapter (Claude wrote them; you make them pass):
```bash
npm run test:e2e                     # all 15 /users tests (+ the 2 old ones)
npm run test:e2e -- -t "part 1"      # only part 1: create + read
npm test                             # unit tests (must stay green)
npm run lint
```

---

## 1. CRUD and HTTP status codes 🚦

**CRUD** = Create, Read, Update, Delete: the 4 basic things an API does with a resource.

| Action        | Route               | Success          | Failure codes           |
|---------------|---------------------|------------------|-------------------------|
| Create        | `POST /users`       | **201** + user   | 400 bad body, 409 dup   |
| Read all      | `GET /users`        | **200** + array  |                         |
| Read one      | `GET /users/:id`    | **200** + user   | 400 bad id, 404 missing |
| Update (part) | `PATCH /users/:id`  | **200** + user   | 400, 404, 409           |
| Delete        | `DELETE /users/:id` | **204**, no body | 400, 404                |

| Code | Name                  | Means                                                     |
|------|-----------------------|-----------------------------------------------------------|
| 200  | OK                    | worked; the body is the result                            |
| 201  | Created               | a new resource was created (Nest's default for POST)      |
| 204  | No Content            | worked; there's nothing to send back (typical for DELETE) |
| 400  | Bad Request           | the client sent invalid data (wrong type, bad email…)     |
| 404  | Not Found             | the thing doesn't exist                                   |
| 409  | Conflict              | valid data, but it clashes with the current state (dup)   |
| 500  | Internal Server Error | **our** bug. Never send it on purpose                     |

🧠 **Memory hook:** 4xx = *"tumhari galti"* (the client's fault), 5xx = *"hamari galti"* (our fault).
A 500 for a duplicate email is a bug: the client did something normal, and we crashed.

## 2. Validating the body: DTO + `class-validator` ✅

The global `ValidationPipe` (in `src/main.ts`) runs **before** your controller method. For a `@Body()`
whose type is a DTO class, it:
1. turns the plain JSON into an instance of that class (`class-transformer`),
2. runs every validation decorator on its fields (`class-validator`),
3. with `whitelist` + `forbidNonWhitelisted`: rejects any field the DTO doesn't declare,
4. on any problem → **400** with a list of messages, and **your method never runs**.

Decorators you need today (all from `class-validator`):

| Decorator         | Rule                                                        |
|-------------------|-------------------------------------------------------------|
| `@IsEmail()`      | must be a valid email → message `email must be an email`    |
| `@IsString()`     | must be a string                                            |
| `@IsOptional()`   | if the field is missing (or null), **skip** its other rules |
| `@MaxLength(100)` | at most 100 characters                                      |
| `@IsNotEmpty()`   | not `''`, not null, not undefined                           |

- `UpdateUserDto extends PartialType(CreateUserDto)` copies **all** these rules and makes every field optional.
  So you write the rules **once**, in `CreateUserDto`.
- **Mass assignment** = a client sends fields you never meant to accept, like `"role": "admin"`, and the code
  saves them. `forbidNonWhitelisted` answers `400 property role should not exist`. That's one of the tests.

## 3. Validating the URL: `ParseIntPipe` 🔢

URL params are **always strings**. `@Param('id', ParseIntPipe) id: number`:
- `'5'` → the number `5`, so your method gets a real `number`
- `'abc'` → **400** `Validation failed (numeric string is expected)`, and your method never runs
- No more `+id` and no more `#NaN` (Day 8, section 7).

## 4. Errors → status codes: Nest's built-in exceptions 🧯

Throw one of these anywhere (usually in the service), and Nest turns it into a JSON error response:

| Throw this                                      | Client gets                            |
|-------------------------------------------------|----------------------------------------|
| `new NotFoundException('User 5 not found')`     | 404 `{"message":"User 5 not found",…}` |
| `new ConflictException('Email already in use')` | 409 with that message                  |
| `new BadRequestException('…')`                  | 400                                    |
| any other `Error` (not an `HttpException`)      | 500 `"Internal server error"`          |

- The 500 hides the real message on purpose (no leaking DB details to the client). The real error is logged.

## 5. Prisma CRUD: what happens when things go wrong 🗄️

`PrismaService` **is** a `PrismaClient` (it `extends` it, see `src/prisma/prisma.service.ts`), so you call
`this.prisma.user.create(…)` and friends. Real behaviour, probed on our DB with Prisma 7.10 + adapter-pg:

| Method                            | Missing record                 | Duplicate email  |
|-----------------------------------|--------------------------------|------------------|
| `create({ data })`                | —                              | throws **P2002** |
| `findMany({ orderBy })`           | returns `[]`                   | —                |
| `findUnique({ where: { id } })`   | returns **`null`** (no error!) | —                |
| `update({ where: { id }, data })` | throws **P2025**               | throws **P2002** |
| `delete({ where: { id } })`       | throws **P2025**               | —                |

Real output of the probe:
```
create         → ["id","email","name","createdAt","updatedAt"]
create dup     → PrismaClientKnownRequestError | instanceof Known: true | code: P2002
                 (Postgres underneath: 23505 "duplicate key value violates unique constraint")
findUnique 404 → null
update missing → PrismaClientKnownRequestError | instanceof Known: true | code: P2025
                 | meta: {"modelName":"User","operation":"an update"}
delete missing → PrismaClientKnownRequestError | instanceof Known: true | code: P2025
                 | meta: {"modelName":"User","operation":"a delete"}
id too big     → PrismaClientKnownRequestError | code: P2020 (Postgres 22003: out of range for Int)
```
- How to check the error type: import `Prisma` from `../generated/prisma/client.js`, then
  `err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'`.
- The `User` **type** comes from the same file (`import type { User } from '../generated/prisma/client.js'`),
  so the generated `entities/user.entity.ts` isn't needed. Delete it.
- **Why not "check if the email exists, then insert"?** Two requests can both check at the same moment, both see
  "free", and both insert (a **race condition**). The DB's `@unique` constraint is the only reliable guard,
  so you let the insert fail and turn **P2002** into **409**. (More on races on Day 18.)

## 6. ⚠️ The `return` without `await` trap (verified)

```js
async function withoutAwait() { try { return fail(); }       catch { return 'caught'; } }
async function withAwait()    { try { return await fail(); } catch { return 'caught'; } }
```
Real output:
```
with await    → caught
without await → escaped: db down
```
- Without `await`, the function returns the promise **right away** and leaves the `try` block. When the promise
  rejects later, nobody is inside the `try` anymore, so the `catch` never runs.
- **In this API** (tried in a scratch copy): `create()` with `return this.prisma.user.create(…)` inside `try`
  made the duplicate-email test fail like this:
  ```
  ERROR [ExceptionsHandler] PrismaClientKnownRequestError: …
  Error: expected 409 "Conflict", got 500 "Internal Server Error"
  ```
- **Rule:** inside `try { }`, always `return await …`.

## 7. Two testing gotchas (already handled for you)

**a) The e2e app doesn't run `main.ts`.** The test builds the app with `createNestApplication()`, so the global
`ValidationPipe` from `main.ts` is **not** there unless the test adds it. `test/users.e2e-spec.ts` adds the same
pipe (see its comment). On Day 10 you'll learn `APP_PIPE`, which puts the pipe inside the module so both get it.

**b) The unit specs need a fake `PrismaService`.** Once `UsersService` injects `PrismaService`, the generated specs
fail. Real output (scratch copy, before the fix):
```
Error: Nest can't resolve dependencies of the UsersService (?). Please make sure that the argument
PrismaService at index [0] is available in the RootTestModule module.
```
`Test.createTestingModule` only has the providers you list, and a unit test must not hit the real DB. Both specs
now provide `{ provide: PrismaService, useValue: {} }`, an empty fake (real mocks: Day 12).

## 8. 🛠️ Build: make `/users` real

**You edit:** `src/users/dto/create-user.dto.ts`, `src/users/users.service.ts`, `src/users/users.controller.ts`,
and delete `src/users/entities/`. **Done =** all e2e tests pass, `npm test` passes, `npm run lint` is clean.

**Starting point (your code right now):** `Tests 13 failed | 4 passed (17)`. Two of the new tests pass *by accident*:
the empty DTO rejects every field, so "unknown field → 400" and "PATCH bad email → 400" already pass.

**Part 1 (today, ~30 min): create + read.** `npm run test:e2e -- -t "part 1"` → 9 tests.
- `CreateUserDto`: `email` (required, valid email), `name` (optional string, max 100 chars).
- `UsersService` gets `PrismaService` injected and uses it:
  - `create` → returns the new user; duplicate email → **409** `ConflictException`
  - `findAll` → all users, ordered by `id`
  - `findOne` → the user, or **404** `NotFoundException`
- Controller: `ParseIntPipe` on every `:id` (no more `+id`).
- Return **objects**, not strings (so responses are JSON).

**Part 2 (next session, ~20 min): update + delete.** 6 more tests.
- `update` → the updated user; missing id → **404**; email taken → **409**.
- `remove` → **204** with an empty body; missing id → **404**.

🤔 **Think first** (hint ladder, rung 1). Ask for the next hint if you're stuck:
1. Which decorators make `POST {"email":"not-an-email"}` fail, and which makes `name` skippable?
2. How does `UsersService` get `PrismaService`? Why don't you need to import `PrismaModule` in `UsersModule`?
   (Day 8, §5–6.)
3. `findUnique` gives `null` for a missing id. Who turns that into a 404?
4. A duplicate email throws. Which class and `code` do you check, and which Nest exception do you throw instead?
5. Where exactly does `ParseIntPipe` go, and what type does `id` become?
6. (Part 2) `update`/`delete` on a missing id throw **P2025**, not `null`. Which decorator makes `DELETE` reply 204?

### 🔍 Round 1: your work in progress (11-02)

**a) The 400 you hit while testing by hand.** Real output (your running dev server):
```
$ curl -X POST localhost:3000/users -H 'content-type: application/json' --data-binary '"{\n email: \"asha@shop.dev\"}"'
{"message":"Unexpected token '\"', \"\"{\n email:\"... is not valid JSON","error":"Bad Request","statusCode":400}

$ curl -X POST localhost:3000/users -H 'content-type: application/json' -d '{"email":"not-an-email"}'
{"message":["email must be an email","password must be a string","name must be a string",
 "age must be a number conforming to the specified constraints"],"error":"Bad Request","statusCode":400}
```
- The body was a JSON **string** (the object wrapped in quotes), not a JSON **object**. Express's JSON parser only
  accepts an object `{…}` or an array `[…]` at the top, so it failed **before** Nest or your code ran.
- **Send it right in Thunder Client** (the VS Code extension you use):
  1. New Request → method **POST** → URL `http://localhost:3000/users`
  2. **Body** tab → **JSON** sub-tab (it sets `Content-Type: application/json` for you)
  3. Type the object with **no quotes around it** and **double quotes on every key**:
     ```json
     {"email": "asha@shop.dev", "name": "Asha"}
     ```
  4. Send, and read the **status** next to the response (201, 400, 409…), not only the body.
- ❌ `"{ email: … }"` = a JSON **string** (what you sent). ❌ `{ email: "…" }` = not JSON (keys need quotes).
  ✅ `{"email": "…"}`. With curl: `-d '{"email":"…"}'`.
- Tip: save one request per test case in a Thunder Client collection (create, bad email, duplicate, `/users/abc`,
  missing id…). Then you can re-check everything with one click after each change.
- The 2nd output proves the parser is fine with an object: now your **DTO** answers (it demands extra fields).

**b) 🧠 Prisma queries are lazy.** Real output (scratch copy, real DB):
```
without await → rows saved: 0
with await    → rows saved: 1
unknown fields, not awaited → no error yet, typeof then: function
unknown fields, awaited → PrismaClientValidationError | Unknown argument `password`. Available options are marked with ?.
```
- `this.prisma.user.create({ … })` alone does **nothing**. A Prisma query is a "lazy promise": it only runs
  when you `await` it (or call `.then`). So in round 1 nothing was saved, and no error could show up either.
- Once you do `await` it, fields that aren't columns in `schema.prisma` (`password`, `age`) make Prisma throw
  `PrismaClientValidationError`: not an `HttpException`, so the client would get a **500**.

**c) 🧠 The `.then` trap in your `findAll`.** Your code:
```ts
findAll() {
  const users = this.prisma.user.findMany().then((users) => {
    console.log('users', users);
  });
  console.log('users', users);
  return { message: 'This action returns all users', users: users, status: 200 };
}
```
Real output: your dev server, then the same shape in plain Node (fake 10 ms "DB call"):
```
GET /users → {"message":"This action returns all users","users":{},"status":200}  [200]

outside      : Promise { <pending> }
as JSON      : {"users":{}}
inside .then : [ { id: 1, email: 'asha@shop.dev' } ]
awaited      : undefined
```
- `users` is **not** the array. It's the **promise** that `.then()` returns.
- The 2nd `console.log` runs **before** the DB answers (Day 2–3: sync code first, callbacks later), so it shows
  `Promise { <pending> }`.
- Your `.then` callback logs the array but **returns nothing**, so the promise ends up holding `undefined`.
- A promise **inside** an object becomes `{}` in JSON. Nest only waits for a promise you **return directly**.
- **Fix pattern:** make the method `async` and return the Prisma result itself. Nest awaits it and sends the array:
  ```ts
  async findAll() {
    return this.prisma.user.findMany({ orderBy: { id: 'asc' } });
  }
  ```

**d) Review notes on round 1:**

1. **`CreateUserDto`** has `password`, `age` and a required `name`. They aren't columns in the `User` table.
   The spec is `email` (required) + `name` (optional, max 100).
2. **Service methods** call Prisma without `await`, so the query never runs (b). Make them `async` and `await`.
3. **Service returns** `{ message, status: 201, user: dto }`: an echo of the input, with no `id`.
   Return what Prisma gives you (the saved user).
4. **`status: 200` in the body** doesn't set the HTTP status. Nest already sends 201/200; errors use exceptions.
5. **Controller:** `ParseIntPipe` ✅ good, but `id` is now a **number**, so type it `number` and drop the `+`.
6. **Missing:** `findOne` → `null` must become `NotFoundException`; `create` → P2002 must become `ConflictException`.
7. **`console.log`** in the service: remove it (proper logging comes on Day 26).

- Passwords come on **Day 22**, and then they're **hashed** (argon2/bcrypt), never stored as plain text.

### ✅ Final version (11-03, written by Claude at the learner's request, with line-by-line comments)

Read the files themselves; every important line has a comment explaining **what** and **why**:
- `src/users/dto/create-user.dto.ts`: `@IsEmail() email`, plus `@IsOptional() @IsString() @MaxLength(100) name?`
- `src/users/dto/update-user.dto.ts`: `PartialType(CreateUserDto)`
- `src/users/users.service.ts`: Prisma injected; `findOne` checks `null` → `NotFoundException`
- `src/users/users.controller.ts`: `ParseIntPipe` + `id: number`; `@HttpCode(204)` on delete
- `src/users/entities/` deleted (the Prisma-generated `User` type replaces it)
- The 409 and 404 for P2002/P2025 come from the **global Prisma exception filter** (Day 10, `notes/09` §4).

Result: `npm run test:e2e` → **Tests 24 passed (24)** (all 15 `/users` tests + 7 lifecycle tests + 2 old ones),
`npm test` → 3 passed, `npm run lint` → clean.

The service, shortened (comments removed here):
```ts
create(dto: CreateUserDto): Promise<User> {
  return this.prisma.user.create({ data: dto });                 // dup email → P2002 → filter → 409
}
findAll(): Promise<User[]> {
  return this.prisma.user.findMany({ orderBy: { id: 'asc' } });
}
async findOne(id: number): Promise<User> {
  const user = await this.prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundException(`User ${id} not found`); // null is not an error → check it
  return user;
}
update(id: number, dto: UpdateUserDto): Promise<User> {
  return this.prisma.user.update({ where: { id }, data: dto });   // missing → P2025 → filter → 404
}
async remove(id: number): Promise<void> {
  await this.prisma.user.delete({ where: { id } });              // missing → P2025 → filter → 404
}
```
- **Why plain `return` is fine here (and §6 said `return await`):** §6 is about returning **inside a `try`**.
  There's no `try/catch` in this service anymore, so the rejected promise simply travels up to Nest, and the
  filter answers. Nest awaits whatever you return.
- **Why `findOne` is `async` but `findAll` isn't:** `findOne` has to **look at** the result (is it `null`?), so it
  must `await`. `findAll` just hands the promise to Nest.

🗣️ **Explain back (answer in your own words):**
1. `update` and `remove` never check for a missing user, yet a missing id gives 404. Where does that 404 come from?
2. Why does `findOne` check for `null` itself, instead of relying on the filter too?
3. What would happen to a duplicate email if the `PrismaExceptionFilter` were deleted?

## 9. 📝 Revision Q&A: Day 9 interview questions

**Say your answer out loud first**, then open the box.

**Q1. ★ How do you validate request data in Nest?**
<details><summary>✅ Answer</summary>

With DTO classes and the `ValidationPipe`. The DTO declares each field with `class-validator` decorators like
`@IsEmail()` or `@IsOptional()`. The pipe, set globally in `main.ts`, turns the JSON body into a DTO instance,
runs the rules, and returns a 400 with the list of errors before the controller runs. With `whitelist` and
`forbidNonWhitelisted`, unknown fields are rejected too, which blocks mass assignment. For URL params I use pipes
like `ParseIntPipe`, so an id like `abc` is a 400 and the handler receives a real number.
</details>

**Q2. ★ 400 vs 404 vs 409 (vs 422)?**
<details><summary>✅ Answer</summary>

400: the request itself is invalid (bad email, id not a number). 404: the resource doesn't exist. 409: the request
is valid but conflicts with the current state, like registering an email that's already taken. 422 Unprocessable
Entity is used by some APIs for validation errors instead of 400. Nest's `ValidationPipe` uses 400 by default
(changeable with `errorHttpStatusCode`). What matters is being consistent and never sending a 500 for a client mistake.
</details>

**Q3. PUT vs PATCH?**
<details><summary>✅ Answer</summary>

`PUT` replaces the **whole** resource: you send every field, and missing fields are cleared or defaulted.
`PATCH` changes only the fields you send. That's why our `UpdateUserDto` is `PartialType(CreateUserDto)`: same
rules, all optional. `PUT` is idempotent by definition (sending it twice gives the same result).
</details>

**Q4. ★ How do you handle a duplicate email? Why not check first?**
<details><summary>✅ Answer</summary>

Put a unique constraint on the column (`@unique` in the Prisma schema), just insert, and catch the error: Prisma
throws `PrismaClientKnownRequestError` with code `P2002`, which I turn into a 409 `ConflictException`. Checking
first ("does this email exist?") isn't safe: two requests can check at the same time, both see it's free, and both
insert. That's a race condition. Only the database constraint is atomic, so it must be the real guard.
</details>

**Q5. What is mass assignment, and how do you prevent it?**
<details><summary>✅ Answer</summary>

When the API saves whatever fields the client sends, a client can set fields it shouldn't, like `role: "admin"`
or `isVerified: true`. Prevent it by accepting only a declared shape: a DTO plus `whitelist: true` (strip unknown
fields) or `forbidNonWhitelisted: true` (reject them with a 400), and never pass the raw body straight to the ORM.
</details>

**Q6. Where should "DB error → HTTP error" mapping live?**
<details><summary>✅ Answer</summary>

Not in the controller, which should stay thin. Today we do it in the service: it knows the business meaning
("email already in use"). In bigger apps, a global **exception filter** maps Prisma errors in one place (P2002 →
409, P2025 → 404), so every service doesn't repeat the same `try/catch`. That's on Day 10. Either way, unexpected
errors must reach the client as a plain 500, with the details only in the logs.
</details>

**Q7. Why does `return` vs `return await` matter inside `try/catch`?**
<details><summary>✅ Answer</summary>

`return promise` leaves the `try` block immediately, so if the promise rejects later, the `catch` never runs and
the error escapes. `return await promise` waits inside the `try`, so the `catch` handles the rejection. In our API
that was the difference between a correct 409 and a 500 for a duplicate email.
</details>

---

## ⚠️ Interview traps

| They say…                                    | You say…                                           |
|----------------------------------------------|----------------------------------------------------|
| "`findUnique` throws when nothing is found." | Returns **`null`**; `update`/`delete` throw P2025  |
| "Check if the email exists, then insert."    | Race condition. Rely on `@unique` + catch P2002    |
| "Send 500 when the email is taken."          | It's the client's case: **409 Conflict**           |
| "DELETE should return the deleted user."     | Usually **204**, no body. Just be consistent       |
| "`return` inside `try` is enough."           | Without `await`, the rejection escapes the `catch` |
| "e2e tests use the pipes from `main.ts`."    | No: `createNestApplication()` skips `main.ts`      |
| "Unit tests can use the real DB service."    | Use a fake/mock provider; stay offline             |
| "Params are numbers if typed `number`."      | They're strings. `ParseIntPipe` converts + checks  |
| "Calling `create()` saves the row."          | Only when **awaited**: Prisma queries are lazy     |
