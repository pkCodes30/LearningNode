# 07 · Nest week begins: your first resource (Day 8)

> **The whole chapter in one line:**
> A Nest **resource** = a **module** (the box) + a **controller** (takes requests) + a **service** (does the work)
> + **DTOs** (the shape of the data). The CLI writes the skeleton in 2 seconds; Nest's **DI container** reads the
> decorators and wires everything together at startup. Your job: understand every file, then (Day 9) make it real.

Demos:
```bash
npm run build && node playground/day08/01-metadata.mjs          # what Nest reads from your classes
node playground/day08/02-raw-users.mjs                          # the same API with only node:http
npx tsc -p playground/day08 && node playground/day08/dist/03-module-exports.js   # then add: export
```

---

## 0. The new plan 🗺️ (the learner's choice, 11-01)

Nest moved up. Days 5–7 come right after the Nest week, so nothing is dropped.

| Order | Day | Topic                                                                      |
|-------|-----|----------------------------------------------------------------------------|
| now   | 8   | ★ Nest architecture & DI: generate `users`, understand every file          |
|       | 9   | Users CRUD with Prisma: DTOs, validation, pipes, status codes, P2002 → 409 |
|       | 10  | ★ Request lifecycle: middleware → guards → interceptors → pipes → filters  |
|       | 11  | Config & custom providers, dynamic modules, circular deps                  |
|       | 12  | Testing: unit tests with mocks, e2e with supertest                         |
|       | 13  | Products API + Swagger; **DevOps: CI on GitHub Actions**                   |
|       | 14  | Week 2 review + Nest mock round                                            |
| then  | 5–7 | HTTP from scratch · streams & EventEmitter · errors, `process`, signals    |

**Already learned, revise alongside this chapter:**
- `notes/01-project-tour.md`: how the app starts, and a request's journey through `GET /health`
- `notes/02-decorators-and-di.md`: §9 how Nest does DI, §11 module rules, §12 scopes
- `notes/04-nest-decorators.md`: routes, params, DTOs, pipes

## 1. Step 0 (done): the tests are green again 🟢

On 11-01 the greeting changed to `'Hello World'`, but 2 tests still expected `'Hello World!'`. Both were updated:
- `src/app.controller.spec.ts`, line 19 (unit test): `npm test` went from 1 failed → **1 passed**
- `test/app.e2e-spec.ts`, line 23 (e2e test): `npm run test:e2e` → **2 passed**

**Rule:** a behaviour change and its test update go in the **same commit**. From Day 13, CI blocks red builds.

## 2. Step 1 (done): generate the `users` resource ⚙️

```bash
npx nest g resource users --type rest --crud
```
`--type rest --crud` answers the 2 questions the CLI would otherwise ask ("REST API?", "CRUD entry points?").
Use `npx`, because the global `nest` on this laptop is the old v11 for office projects.

Real output (Nest CLI 12.0.8, in this repo):
```
CREATE src/users/users.controller.spec.ts (572 bytes)
CREATE src/users/users.controller.ts (903 bytes)
CREATE src/users/users.module.ts (254 bytes)
CREATE src/users/users.service.spec.ts (456 bytes)
CREATE src/users/users.service.ts (615 bytes)
CREATE src/users/dto/create-user.dto.ts (30 bytes)
CREATE src/users/dto/update-user.dto.ts (172 bytes)
CREATE src/users/entities/user.entity.ts (21 bytes)
UPDATE package.json (2008 bytes)
UPDATE src/app.module.ts (575 bytes)
- Installing packages (npm)...
✔ Packages installed successfully.
```
After it: `npm run build` ✅ · `npm test` → **3 files, 3 tests passed** · e2e → 2 passed ·
`npm run lint` → 2 warnings ("`createUserDto` / `updateUserDto` declared but never used", fixed on Day 9).

- ✅ It's **ESM-aware**: every import it writes ends in `.js` (Day 4).
- ✅ It **registers** `UsersModule` in `src/app.module.ts` for you.
- ⚠️ It added `"@nestjs/mapped-types": "*"` to `package.json`. **Day 4 semver:** `*` accepts **any** version,
  even a future breaking major. It was changed to `"^12.0.0"` (the installed version) and `npm install` re-run,
  so the lockfile matches.

## 3. The big picture: 3 building blocks 🍽️

🧠 **Memory hook: a restaurant chain** (same as the Day 1 map)

| Nest piece       | Restaurant                | Its one job                                     |
|------------------|---------------------------|-------------------------------------------------|
| **Module**       | a branch / department     | groups related pieces; decides what's shared    |
| **Controller**   | the waiter at the counter | takes the request (route), hands it on, replies |
| **Provider**     | the chef (a service)      | does the real work: business logic, DB calls    |
| **DI container** | the manager               | hires each chef **once** and assigns them       |
| **DTO**          | the order slip            | the exact shape of what the customer sends      |

- **Provider** = anything Nest can create and inject. Usually a class with `@Injectable()` (a "service").
- **IoC (Inversion of Control)** = *you* don't create your dependencies with `new`; the framework creates
  them and **gives** them to you. **DI (Dependency Injection)** is the way it gives them: through the constructor.
- 🎯 **Thin controller, fat service:** the controller only reads the request and calls the service.
  All logic goes in the service, so it's reusable (other services can call it) and easy to unit-test.

## 4. Every generated file, one by one 🔍

### 4.1 `users.module.ts`: the box

```ts
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```
- `@Module` stores **metadata** (a list of what's inside) on the class. The class itself is empty.
- `controllers`: classes that handle routes. `providers`: classes Nest should create and be able to inject.
- Missing pieces it doesn't need yet: `imports: []` (other modules it uses) and `exports: []` (what it shares).
  **By default everything in a module is private** to that module (section 6).

### 4.2 `app.module.ts`: plugging the box in

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  PrismaModule,
  HealthModule,
  UsersModule,          // ← added by the generator
],
```
- Nest only knows modules it can **reach from the root module** (`AppModule`, passed to `NestFactory.create` in
  `src/main.ts`). Forget this line and the `/users` routes simply don't exist (404), with no error.

### 4.3 `users.controller.ts`: the waiter

```ts
@Controller('users')                                   // every route here starts with /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}   // ← DI: "I need a UsersService"

  @Post()                                              // POST /users
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()                                               // GET /users
  findAll() { return this.usersService.findAll(); }

  @Get(':id')                                          // GET /users/5  → id = '5' (always a STRING)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);             // +'5' = 5, but +'abc' = NaN 😱
  }

  @Patch(':id')                                        // PATCH /users/5 (partial update)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Delete(':id')                                       // DELETE /users/5
  remove(@Param('id') id: string) { return this.usersService.remove(+id); }
}
```
Line by line:
- `private readonly usersService: UsersService` is a TypeScript **parameter property**: it declares the field and
  assigns it in one go. Nest sees the **type** `UsersService` and injects the right object (section 5).
- `@Body()` = the parsed JSON body. `@Param('id')` = the `:id` part of the URL. URL params are **always strings**.
- Whatever you **return** becomes the response. Nest sends it for you; you never call `res.send()`.
  - A **string** → `text/html; charset=utf-8`. An **object or array** → `application/json` (real output below).
- **Default status codes:** `POST` → **201**, everything else → **200**. Change it with `@HttpCode(204)`.

### 4.4 `users.service.ts`: the chef

```ts
@Injectable()
export class UsersService {
  create(createUserDto: CreateUserDto) { return 'This action adds a new user'; }
  findAll()                            { return `This action returns all users`; }
  findOne(id: number)                  { return `This action returns a #${id} user`; }
  update(id: number, updateUserDto: UpdateUserDto) { return `This action updates a #${id} user`; }
  remove(id: number)                   { return `This action removes a #${id} user`; }
}
```
- `@Injectable()` marks the class so Nest can manage it **and** makes TypeScript save its constructor types
  (forget it on a class *with* dependencies and they come in as `undefined`; see `notes/04`).
- These are **placeholders**. On Day 9 you inject `PrismaService` here and do real DB work.
- The service knows **nothing** about HTTP (no `req`, no status codes). That's on purpose: the same service can be
  used by a controller, a cron job or a queue worker.

### 4.5 `dto/create-user.dto.ts`: the order slip

```ts
export class CreateUserDto {}       // empty for now
```
- **DTO = Data Transfer Object**: the shape of data coming **in** (here, the body of `POST /users`).
- It **must be a class**, not a TS `interface`: interfaces disappear when TS compiles to JS, but the global
  `ValidationPipe` needs a real class at runtime to read the `@IsEmail()`-style rules from.
- Empty + `forbidNonWhitelisted` = **every** field is rejected (puzzle in section 7). Day 9: add the rules.

### 4.6 `dto/update-user.dto.ts`: "the same slip, everything optional"

```ts
import { PartialType } from '@nestjs/mapped-types';
export class UpdateUserDto extends PartialType(CreateUserDto) {}
```
- `PartialType` builds a new class with the **same fields and validation rules**, but all **optional**.
  Perfect for `PATCH`, where the client sends only what changes. You write the rules **once**.
- (On Day 13 we'll import `PartialType` from `@nestjs/swagger` instead, so the API docs see the fields too.)

### 4.7 `entities/user.entity.ts`

```ts
export class User {}
```
- An "entity" = the shape of a row in the DB. The generator assumes TypeORM-style entities.
- With **Prisma**, the `User` type is generated for you from `prisma/schema.prisma` into `src/generated/prisma`,
  so this file will likely be **deleted** on Day 9.

### 4.8 `users.controller.spec.ts` and `users.service.spec.ts`: smoke tests

```ts
const module = await Test.createTestingModule({
  controllers: [UsersController],
  providers: [UsersService],
}).compile();
controller = module.get<UsersController>(UsersController);
expect(controller).toBeDefined();
```
- `Test.createTestingModule` builds a **mini Nest app** just for the test, with only the pieces you list.
- "should be defined" only proves **DI works** (the class could be created with its dependencies).
- Day 12: here you'll swap the real `PrismaService` for a **mock**. That's DI's superpower for testing.

## 5. How Nest wires it all at startup (DI step by step) 💉

Nest doesn't guess. Decorators **store metadata** on your classes, and Nest **reads** it. Real output of
`node playground/day08/01-metadata.mjs` (it reads the same metadata from the compiled `dist/`):
```
@Module      controllers : [ 'UsersController' ]
@Module      providers   : [ 'UsersService' ]
@Injectable  on service  : true
@Controller  path        : users
constructor  needs       : [ 'UsersService' ]
@Get(":id")  path        : :id
@Get(":id")  method      : 0 (0 = GET in RequestMethod)
```
The startup, in order:
1. `src/main.ts` calls `NestFactory.create(AppModule)`.
2. **Scan:** Nest reads `@Module` metadata from `AppModule`, follows `imports` → finds `UsersModule` and its
   `controllers` + `providers` (lines 1–2 above).
3. **Read the needs:** for each class it reads `design:paramtypes`, the constructor types TypeScript saved
   (`emitDecoratorMetadata`). `UsersController` needs `[UsersService]` (line 5).
4. **Resolve:** it looks for a provider with that **token** (here the class itself) in the **same module**,
   then in what imported modules **export**, then in `@Global()` modules.
5. **Create, dependencies first:** `UsersService` is created, then `UsersController` with it.
   Each provider is created **once** (singleton) and shared. Log: `UsersModule dependencies initialized`.
6. **Routes:** it reads `@Controller('users')` + `@Get(':id')` (lines 4, 6, 7) and registers them in Express.
   Real log lines:
   ```
   Mapped {/users, POST}
   Mapped {/users, GET}
   Mapped {/users/:id, GET}
   Mapped {/users/:id, PATCH}
   Mapped {/users/:id, DELETE}
   ```
7. `app.listen(3000)`: ready for requests.

- If a route is missing from the `Mapped` list, its controller isn't in any module reachable from `AppModule`.

## 6. 🤔 Puzzle: module walls (`exports`)

`OrdersService` lives in `OrdersModule` and needs `UsersService`, which lives in `UsersModule`:
```ts
@Injectable() class UsersService {}
@Injectable() class OrdersService { constructor(readonly users: UsersService) {} }

@Module({ providers: [UsersService], exports: [] })            // ← run 1: NOT exported
class UsersModule {}                                            //   run 2: exports: [UsersService]

@Module({ imports: [UsersModule], providers: [OrdersService] })
class OrdersModule {}
```
**Predict:** run 1 (not exported) and run 2 (exported). In run 2, how many `UsersService` objects exist?

<details><summary>👀 Real output + why</summary>

```
$ node playground/day08/dist/03-module-exports.js
UsersModule exports UsersService: false
❌ Nest can't resolve dependencies of the OrdersService (?). Please make sure that the argument UsersService
   at index [0] is available in the OrdersModule module.

$ node playground/day08/dist/03-module-exports.js export
UsersModule exports UsersService: true
✅ OrdersService got a UsersService: true
UsersService objects created: 1
```
- **Importing a module is not enough.** You only get what that module **exports**. A module is like a company
  department: other departments can only use the people it officially lends out.
- How to read the error: `(?)` marks **which** constructor argument failed (`index [0]`), and it names the
  module where Nest looked (`OrdersModule`). Fix: export it from its own module and import that module.
- **1 object:** providers are **singletons** by default. Every module that imports `UsersModule` gets the
  **same** instance.
- **The `@Global()` shortcut, in this repo:** `src/prisma/prisma.module.ts` is `@Global()` and exports
  `PrismaService`. That's why `HealthModule` never imports `PrismaModule`, yet `HealthController` still gets
  `PrismaService`. Use `@Global()` only for truly app-wide things (DB, config, logger). Overusing it hides
  which module depends on what.
</details>

## 7. 🤔 Puzzle: the generated API, before you change anything

Remember `src/main.ts`: a global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`.
**Predict** the body **and** the status code of each:
1. `GET /users/abc`
2. `POST /users` with body `{}`
3. `POST /users` with body `{"email":"a@b.com"}`
4. Bonus: `POST /users` with the broken body `{bad json`, and `GET /users/5/orders`

<details><summary>👀 Real output + why</summary>

```
GET /users                         → This action returns all users  [200 text/html; charset=utf-8]
GET /users/5                       → This action returns a #5 user  [200 text/html; charset=utf-8]
GET /users/abc                     → This action returns a #NaN user  [200 text/html; charset=utf-8]
POST /users {}                     → This action adds a new user  [201 text/html; charset=utf-8]
POST /users {"email":"a@b.com"}    → {"message":["property email should not exist"],"error":"Bad Request",
                                      "statusCode":400}  [400 application/json; charset=utf-8]
POST /users {bad json              → {"message":"Expected property name or '}' in JSON at position 1
                                      (line 1 column 2)","error":"Bad Request","statusCode":400}  [400]
PATCH /users/5 {}                  → This action updates a #5 user  [200 text/html; charset=utf-8]
DELETE /users/7                    → This action removes a #7 user  [200 text/html; charset=utf-8]
GET /users/5/orders                → {"message":"Cannot GET /users/5/orders","error":"Not Found",
                                      "statusCode":404}  [404 application/json; charset=utf-8]
```
1. **`GET /users/abc` → `#NaN`, 200** 😱
   - The route `:id` matches **anything**, so `id = 'abc'` (a string).
   - `+'abc'` is `NaN`, and nothing checks it, so garbage goes through with a **success** code.
   - **Day 9 fix:** `@Param('id', ParseIntPipe) id: number` → `400 "Validation failed (numeric string is
     expected)"` before your code even runs (proved in `notes/04`).
2. **`POST {}` → 201**
   - The DTO is empty, so nothing is required, and nothing is extra. It passes.
   - POST's default status is **201 Created**, even though nothing was created yet.
3. **`POST {"email":…}` → 400 "property email should not exist"**
   - `whitelist` **strips** body fields the DTO doesn't declare; `forbidNonWhitelisted` **rejects** the request
     instead of stripping. The DTO declares nothing, so even a perfect `email` is "not allowed".
   - **Day 9 fix:** declare it with a rule: `@IsEmail() email: string;` in `CreateUserDto`.
4. **Bonus**
   - **Broken JSON → 400 for free:** Express's body parser fails and Nest turns it into a clean 400 JSON error.
   - **Unknown route → 404 JSON:** `Cannot GET /users/5/orders`.
- **Content types:** the generated service returns **strings**, so the replies are `text/html`. Errors (and,
  from Day 9, your objects) are `application/json`. A real JSON API should return objects.
- `DELETE` returns 200 here. Many APIs return **204 No Content** for a delete; we'll decide on Day 9.
</details>

## 8. Nest vs raw `node:http`: what does the framework do for you? 🆚

`playground/day08/02-raw-users.mjs` is a tiny users API **without** any framework (~45 lines for 3 routes).
Real output:
```
GET /users                           → 200 [{"id":1,"email":"asha@shop.dev"}]
GET /users/1                         → 200 {"id":1,"email":"asha@shop.dev"}
GET /users/abc                       → 404 {"message":"Cannot GET /users/abc"}
POST /users {"email":"ravi@shop.dev"} → 201 {"id":2,"email":"ravi@shop.dev"}
POST /users {"email":"nope"}         → 400 {"message":"email must be an email"}
POST /users {bad json                → 400 {"message":"Invalid JSON"}
DELETE /users/1                      → 404 {"message":"Cannot DELETE /users/1"}
```
What you had to write **by hand** in raw Node, and who does it in Nest:

| Job                     | Raw `node:http`                   | Nest                      |
|-------------------------|-----------------------------------|---------------------------|
| Routing                 | `if` + `url.match(…)`             | `@Get(':id')`             |
| Read the body           | `for await (… of req)` (a stream) | `@Body()`                 |
| Bad JSON → 400          | your own `try/catch`              | automatic                 |
| Validate fields         | your own `if` checks              | DTO + `ValidationPipe`    |
| Numeric id              | regex `(\d+)`                     | `ParseIntPipe`            |
| JSON + status + headers | `writeHead` + `JSON.stringify`    | just `return`             |
| Errors → JSON           | by hand, everywhere               | throw `NotFoundException` |
| Wiring + testing        | globals, hard to mock             | DI, `createTestingModule` |

- Interesting: the raw server's regex `(\d+)` was **stricter** than the generated Nest code (`abc` → 404, not
  `#NaN`). A framework only protects you if you **use** its tools (pipes, DTOs).
- Under the hood Nest still runs on Node's `http` module, through **Express** (`@nestjs/platform-express`).
  Nest adds structure (modules, DI, decorators) on top; it doesn't replace Node.
- Day 5 (after the Nest week) builds a fuller raw server, so you'll know exactly what Express and Nest save you.

## 9. What Day 9 will change ⏭️

Day 9 = **you** turn this skeleton into a real `/users` CRUD with Prisma:
- `CreateUserDto` gets real rules (`@IsEmail()`, `@IsString()`, …) → section 7's puzzle 3 is fixed.
- `@Param('id', ParseIntPipe) id: number` → puzzle 1 is fixed.
- `UsersService` injects `PrismaService` and returns **objects** (JSON) from the DB, not strings.
- Not found → `NotFoundException` (404). Duplicate email → Prisma error `P2002` → **409 Conflict**.

## 10. 📝 Revision Q&A: Day 8 interview questions

**Say your answer out loud first**, then open the box.

**Q1. ★ What are modules, controllers and providers in Nest?**
<details><summary>✅ Answer</summary>

A **module** is a class with `@Module()` that groups related pieces and decides what is shared (`imports`,
`exports`). The app is a tree of modules starting at `AppModule`. A **controller** handles HTTP routes: it reads
the request with decorators like `@Param` and `@Body`, calls a service, and returns the response. A **provider** is
anything Nest can create and inject, usually an `@Injectable()` service that holds the business logic. Controllers
stay thin; services do the work, so they're reusable and easy to test.
</details>

**Q2. ★ What is dependency injection, and how does Nest resolve a dependency?**
<details><summary>✅ Answer</summary>

DI means a class doesn't create its dependencies with `new`; it declares them in its constructor and the framework
**gives** them in. This is Inversion of Control. Nest does it at startup: decorators store metadata, and with
`emitDecoratorMetadata`, TypeScript saves each constructor's parameter types (`design:paramtypes`, read via
`reflect-metadata`). Nest scans the module tree from `AppModule`, reads what each class needs, looks for a provider
with that token in the same module, then in exports of imported modules, then in global modules, creates the
dependencies first, and injects them. By default each provider is a singleton.
</details>

**Q3. ★ You imported `UsersModule` but still get "Nest can't resolve dependencies…". Why? What's `@Global()`?**
<details><summary>✅ Answer</summary>

Importing a module only gives you what it **exports**. If `UsersModule` doesn't list `UsersService` in `exports`,
other modules can't inject it, and you get "Nest can't resolve dependencies of the OrdersService (?)… argument
UsersService at index [0]". Fix: export it. `@Global()` makes a module's exports available everywhere without
importing it, like our `PrismaModule`. Use it only for app-wide things like DB or config, because it hides
dependencies.
</details>

**Q4. What is the default provider scope? What other scopes exist?**
<details><summary>✅ Answer</summary>

**Singleton** (`DEFAULT`): one instance for the whole app, created at startup, shared everywhere (the demo created
exactly 1). `REQUEST`: a new instance per request, useful for per-request data, but slower, and it "bubbles up"
(everything that injects it also becomes request-scoped). `TRANSIENT`: a new instance for every class that injects
it. Prefer singletons, and keep them stateless. More in `notes/02` §12.
</details>

**Q5. Why are DTOs classes and not interfaces?**
<details><summary>✅ Answer</summary>

TypeScript interfaces vanish at compile time, so nothing is left at runtime. The `ValidationPipe` needs a real class:
it turns the plain JSON body into an instance (class-transformer) and reads the validation decorators on it
(class-validator). So DTOs must be classes. With `whitelist` and `forbidNonWhitelisted`, any field not declared in
the DTO is rejected, which also blocks mass-assignment attacks.
</details>

**Q6. What does Nest give you compared with plain Node or Express?**
<details><summary>✅ Answer</summary>

Plain Node gives you a raw request and response: you write routing, body parsing, validation, JSON responses and
error handling yourself (section 8). Express adds routing and middleware, but no structure. Nest runs on top of
Express (or Fastify) and adds an opinionated architecture: modules, DI, decorators for routes and params, pipes for
validation, guards, interceptors and exception filters, plus a testing module. The big wins are structure in large
codebases and easy testing, because DI lets you swap real dependencies for mocks.
</details>

**Q7. What status code and content type does Nest send by default?**
<details><summary>✅ Answer</summary>

`POST` → 201, everything else → 200; change it with `@HttpCode()`. Returning an object or array → JSON
(`application/json`); returning a string → `text/html` (real output in section 7). Thrown `HttpException`s become
JSON error bodies like `{"statusCode":404,"message":"…","error":"Not Found"}`.
</details>

---

*Next: Day 9, where you write the real `/users` CRUD with Prisma. The spec and tests come next session.*

## ⚠️ Interview traps

| They say…                                     | You say…                                           |
|-----------------------------------------------|----------------------------------------------------|
| "`+id` is fine for route params."             | `+'abc'` = `NaN` → 200 garbage. Use `ParseIntPipe` |
| "An empty DTO accepts any body."              | With `forbidNonWhitelisted` it rejects every field |
| "`*` in package.json is a safe version."      | It allows **any** version, even breaking majors    |
| "Importing a module gives all its providers." | Only what it **exports**                           |
| "Nest makes a new service per request."       | Default scope is **singleton**: one, shared        |
| "DTOs can be interfaces."                     | Interfaces vanish at runtime; pipes need a class   |
| "Returning a string sends JSON."              | A string → `text/html`. Return objects             |
| "Nest replaces Node's HTTP server."           | It runs on Express/Fastify, on `node:http`         |
| "Use `@Global()` to stop DI errors."          | Only for app-wide things (DB, config)              |