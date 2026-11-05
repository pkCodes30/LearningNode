# 10 · Config & custom providers (Day 11)

> **The whole chapter in one line:**
> A provider is "a **token** + a **recipe**". The token is the name tag you ask for; the recipe says how Nest makes
> the thing: **create a class** (`useClass`), **use a ready value** (`useValue`), **run a function** (`useFactory`),
> or **reuse another provider** (`useExisting`).

Demo:
```bash
npx tsc -p playground/day11 && node playground/day11/dist/01-custom-providers.js
NODE_ENV=production node playground/day11/dist/01-custom-providers.js
node playground/day11/dist/02-dynamic-module.js
node playground/day11/dist/circular-broken/main.js       # crashes on purpose
node playground/day11/dist/circular-fixed/main.js
```

---

## 1. Token = the name tag 🔖 (recap of `notes/02` §10)

When a constructor asks for something, Nest looks it up by its **token**:

| Token type            | Example                   | How you ask for it                    |
|-----------------------|---------------------------|---------------------------------------|
| a class               | `UsersService`, `Mailer`  | just the type: `(mailer: Mailer)`     |
| a string              | `'APP_NAME'`              | `@Inject('APP_NAME') appName: string` |
| a `Symbol` / constant | `const DB = Symbol('DB')` | `@Inject(DB)`                         |

- Strings and symbols need `@Inject(token)`, because TypeScript only saves **class** types in the metadata.
- **Interfaces can't be tokens:** they vanish at runtime. That's why the demo uses an **abstract class** `Mailer`.
- A `Symbol` (or an exported constant) avoids typos: `'APP_NAME'` vs `'APP_NAME '` would silently be two tokens.

## 2. The four recipes 🍳

🧠 **Memory hook:** *Class = "who to hire", Value = "ready maal", Factory = "recipe", Existing = "nickname".*

| Recipe        | Means                              | Use it for                          |
|---------------|------------------------------------|-------------------------------------|
| `useClass`    | create an instance of this class   | swap implementations (fake vs real) |
| `useValue`    | use this exact value               | constants, config, **test fakes**   |
| `useFactory`  | call this function, use its result | computed or **async** values        |
| `useExisting` | an alias for another token         | two names, **one** instance         |

**You've already used them in this repo:**
- `useValue`: `{ provide: PrismaService, useValue: {} }` in both `src/users/*.spec.ts` (an empty fake, Day 9).
- `useClass`: `{ provide: APP_FILTER, useClass: PrismaExceptionFilter }` in `src/app.module.ts` (Day 10).
- The shorthand: `providers: [UsersService]` is just `{ provide: UsersService, useClass: UsersService }`.

`useFactory` with `inject`, from the demo:
```ts
{
  provide: 'DB_CONFIG',
  useFactory: async (appName: string) => {          // can be async: Nest waits before starting the app
    return { url: `postgres://localhost/${appName.toLowerCase()}`, poolSize: 10 };
  },
  inject: ['APP_NAME'],                              // these providers arrive as the arguments, in order
}
```

## 3. 🤔 Puzzle: what does `SignupService` get?

`SignupService` asks for 4 things: `mailer: Mailer`, `@Inject('APP_NAME') appName`, `@Inject('DB_CONFIG') db` and
`@Inject('EMAIL_SENDER') alias`. The module registers:
```ts
{ provide: Mailer, useClass: useFake ? FakeMailer : SmtpMailer },   // useFake = NODE_ENV !== 'production'
{ provide: 'APP_NAME', useValue: 'ShopLite' },
{ provide: 'DB_CONFIG', useFactory: async (appName) => { factoryRuns++; …; return { url, poolSize: 10 }; },
  inject: ['APP_NAME'] },
{ provide: 'EMAIL_SENDER', useExisting: Mailer },
```
**Predict** the 6 lines:
1. `signup.mailer.send('asha@shop.dev')`: and what changes with `NODE_ENV=production`?
2. `signup.appName`
3. `signup.db`
4. `signup.alias === signup.mailer`
5. how many times the factory ran
6. `app.get(SignupService) === signup`

<details><summary>👀 Real output + why</summary>

```
$ node playground/day11/dist/01-custom-providers.js
1. mailer           : FAKE → pretended to send to asha@shop.dev
2. app name         : ShopLite
3. db config        : { url: 'postgres://localhost/shoplite', poolSize: 10 }
4. alias === mailer : true
5. factory ran      : 1 time(s)
6. same service?    : true

$ NODE_ENV=production node playground/day11/dist/01-custom-providers.js
1. mailer           : SMTP → really sent to asha@shop.dev
```
1. **`useClass` swaps the implementation** without touching `SignupService`. It only knows "a `Mailer`". That's
   DI's big win: dev and tests get a fake mailer, production gets the real one.
2. **`useValue`**: Nest hands over the exact value.
3. **`useFactory`**: Nest called the function with `'ShopLite'` (from `inject`), **awaited** it, and injected the result.
4. **`useExisting` = an alias:** both tokens point to the **same object**, so `true`. (With `useClass: FakeMailer`
   instead, you'd get a second, separate instance → `false`.)
5. **Once:** a factory provider is a singleton too. It runs at startup, and the result is shared.
6. **Singleton:** the default scope; `app.get()` returns the same instance every time.
</details>

---

## 4. Dynamic modules: a module you configure when you import it 🧩

### 4.1 Static vs dynamic

A **static module** is fixed: `@Module({ providers: [...] })` gives every importer the same thing. That's fine for
`UsersModule`. But some modules need **settings from the importer**: a DB module needs a URL, a JWT module needs a
secret, a mailer needs a "from" address. You can't hard-code those inside a reusable module.

A **dynamic module** is a **static method that returns a module description**, built from the options you pass:
```ts
@Module({})
class MailerModule {
  static forRoot(options: MailerOptions): DynamicModule {
    return {
      module: MailerModule,                                     // which module this describes
      providers: [{ provide: MAILER_OPTIONS, useValue: options }, MailerService],
      exports: [MailerService],                                 // what importers may inject
    };
  }
}

@Module({ imports: [MailerModule.forRoot({ from: 'dev@localhost', fake: true })] })
class AppModule {}
```
🧠 **Memory hook:** a static module is a **fixed thali** (same dishes for everyone). A dynamic module is **ordering
your thali**: you say the options ("less spicy, extra roti"), and the kitchen builds that plate for you.

- Nest merges the returned object with the class's own `@Module({})` metadata, then treats it like any module.
- Inside, it's just **custom providers** (section 2): the options become a `useValue` (or `useFactory`) provider
  under a token, and the module's services inject that token. Nothing magic.

### 4.2 The one in your app: `ConfigModule.forRoot()`

`src/app.module.ts` has `ConfigModule.forRoot({ isGlobal: true })`. What does it return? Real output:
```
is a Promise? true
keys      : [ 'module', 'global', 'providers', 'exports' ]
module    : ConfigModule
global    : true
providers : [ 'ConfigService (useFactory)' ]
exports   : [ 'ConfigService' ]
```
- It's exactly the shape above: `module`, `providers`, `exports`, plus `global: true` (that's what `isGlobal`
  does: like `@Global()`, every module can inject `ConfigService` without importing `ConfigModule`).
- `ConfigService` is built by a **`useFactory`**: the factory reads `.env` and `process.env` first.
- In `@nestjs/config` 12 it returns a **Promise** of that object. Nest accepts a promise in `imports` and awaits it.

### 4.3 `forRoot` vs `register` vs `forFeature` (naming conventions)

| Name         | Means                                          | Example                            |
|--------------|------------------------------------------------|------------------------------------|
| `forRoot`    | configure **once**, in the root (often global) | `ConfigModule.forRoot()`           |
| `register`   | configure **per import**; each gets its own    | `JwtModule.register()`             |
| `forFeature` | add a feature's bits to a configured root      | `TypeOrmModule.forFeature([User])` |

These are conventions, not rules: Nest only cares that the method returns a `DynamicModule`.

### 4.4 `…Async`: when the options come from other providers

Usually the options come from `ConfigService` (the env). So you can't write them as plain values at import time:
remember Day 4, imports run **before** any of your code, so the env isn't even read yet. The `…Async` version takes
a **factory**, and Nest calls it at startup, once `ConfigService` exists:
```ts
MailerModule.forRootAsync({
  imports: [EnvModule],                   // where the factory's dependencies live
  inject: [EnvService],                   // passed to useFactory, in this order
  useFactory: async (env: EnvService) => ({
    from: env.get('MAIL_FROM'),
    fake: env.get('MAIL_FAKE') === 'true',
  }),
}),
```
Inside, `forRootAsync` registers `{ provide: MAILER_OPTIONS, useFactory, inject }`: the same `useFactory` from
section 2. On Day 22 you'll write exactly this for JWT:
`JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config) => ({ secret: config.getOrThrow('JWT_SECRET') }) })`.

### 4.5 🤔 Puzzle: two apps, one `MailerModule`

`playground/day11/02-dynamic-module.ts` boots two apps. App 1 imports `MailerModule.forRoot({ from: 'dev@localhost',
fake: true })`. App 2 imports `MailerModule.forRootAsync(...)` with the factory above, where `EnvService` returns
`MAIL_FROM = 'orders@shoplite.dev'` and `MAIL_FAKE = 'false'`. Each app calls `send('asha@shop.dev')`.
`send()` returns `` `${fake ? 'FAKE' : 'REAL'} mail from ${from} to ${to}` ``. **Predict both lines.**

<details><summary>👀 Real output + why</summary>

```
$ npx tsc -p playground/day11 && node playground/day11/dist/02-dynamic-module.js
forRoot      → FAKE mail from dev@localhost to asha@shop.dev
forRootAsync → REAL mail from orders@shoplite.dev to asha@shop.dev
```
- **Same `MailerService` code, different behaviour**, decided only by how each app imported the module.
- App 2's factory ran at startup with the `EnvService` instance (from `inject`), and `'false' === 'true'` is `false`,
  so it's a REAL mailer. Env values are always **strings**: that's why the factory compares with `'true'`.
</details>

## 5. Circular dependencies and `forwardRef` 🐔🥚

### 5.1 The problem

`UsersService` needs `OrdersService` (to show a user's orders), and `OrdersService` needs `UsersService` (to check
the buyer). To build `UsersService`, Nest first needs an `OrdersService`… which first needs a `UsersService`.
*Murgi pehle ya anda?* Neither can be created first.

It can happen at two levels:
- **Providers:** two services inject each other (constructor injection).
- **Modules:** `UsersModule` imports `OrdersModule`, and `OrdersModule` imports `UsersModule`.

### 5.2 🤔 Puzzle: what happens in OUR project (ESM)?

`playground/day11/circular-broken/`: `users.service.ts` imports `OrdersService` and injects it; `orders.service.ts`
imports `UsersService` and injects it. Each class is in its own file, like a real project. **Predict:** does the app
start? If not, *where* does it fail: inside Nest, or before Nest even runs?

<details><summary>👀 Real output + why</summary>

```
$ node playground/day11/dist/circular-broken/main.js
file:///…/playground/day11/dist/circular-broken/orders.service.js:20
    __metadata("design:paramtypes", [UsersService])
                                     ^
ReferenceError: Cannot access 'UsersService' before initialization
```
It fails **while the files are loading**, before Nest does anything. Step by step (Day 4: ESM loads imports first):
1. `main.js` imports `users.service.js`. Before running it, ESM loads **its** import: `orders.service.js`.
2. `orders.service.js` imports `users.service.js`, but that file is already "in progress", so ESM doesn't run it
   again. `UsersService` exists as a name but has **no value yet** (the "temporal dead zone").
3. `orders.service.js` now runs. Its decorator metadata (`design:paramtypes`, the constructor types that
   TypeScript writes for Nest) **reads** `UsersService` → ReferenceError.
- In older CommonJS projects the same mistake shows up differently: the import is `undefined` (a half-finished
  `module.exports`, Day 4), and Nest reports "can't resolve dependencies … index [0]".
</details>

### 5.3 The fix, and why it needs TWO parts in ESM

`playground/day11/circular-fixed/`:
```ts
// users.service.ts (orders.service.ts is the mirror image)
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import type { WrapperType } from './wrapper-type.js';     // export type WrapperType<T> = T;

@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => OrdersService)) readonly orders: WrapperType<OrdersService>,
  ) {}
}
```
- **`forwardRef(() => OrdersService)`** gives Nest a **function** instead of the class. Nest calls it later, when
  both files have finished loading and the class exists. It tells Nest: "this is circular, handle it carefully".
- **`WrapperType<T>`** is just `T` to TypeScript, but because it's a generic alias, the compiler writes `Object`
  into the metadata instead of the class, so nothing touches the class while the file loads. Real compiled output:
  ```
  circular-broken/users.service.js:  __metadata("design:paramtypes", [OrdersService])
  circular-fixed/users.service.js:   __metadata("design:paramtypes", [Object])
  ```

Every combination, tested for real:

| `forwardRef` | `WrapperType` | Result                                                       |
|--------------|---------------|--------------------------------------------------------------|
| ❌           | ❌            | `ReferenceError: Cannot access 'UsersService' before …`      |
| ✅           | ❌            | the **same** ReferenceError (metadata reads the class early) |
| ❌           | ✅            | Nest: `can't resolve dependencies of the UsersService (?)`   |
| ✅           | ✅            | ✅ starts                                                    |

The working run (both on both sides):
```
$ node playground/day11/dist/circular-fixed/main.js
started            : true
users.orders.users : true
orders.users.orders: true
```
- Both services were created, and each holds the **real** other one (`users.orders.users === users`).
- **Modules** use the same idea: `imports: [forwardRef(() => OrdersModule)]` in **both** modules.
- ⚠️ Don't call the other service inside the **constructor** of a circular pair: one of them is created first, so the
  other may not be ready yet. Use it inside normal methods.
- Side note: with `logger: false`, a failing Nest app can exit **silently** (our first WrapperType-only run printed
  nothing). If an app quits with no message, turn the logger back on.

### 5.4 The real fix: don't have the cycle 🔧

`forwardRef` works, but a cycle usually means two classes share a job that belongs somewhere else. Better options:

| Option                      | How                                                               |
|-----------------------------|-------------------------------------------------------------------|
| **Extract a third service** | move the shared logic (e.g. `UserLookupService`) out; both use it |
| **Events instead of calls** | `OrdersService` emits `order.created`; users code listens (Day 6) |
| **Merge them**              | if they always change together, maybe they're really one service  |

Say this in an interview: *"forwardRef is a band-aid; I'd first look for the missing third piece."*

## 6. 🛠️ Build: validate the env at startup (fail fast) ✅

(11-03, written by Claude at the learner's request, with line-by-line comments.)

### 6.1 Why "fail fast"?

Before this build, `main.ts` did `app.listen(process.env.PORT ?? 3000)`, with no checks. A typo like `PORT=300O`
would only show up later, as a strange error, maybe in production at 2 a.m. **Fail fast** = check every setting
**once, at startup**, and refuse to start with one clear message listing **all** the problems.
🧠 *Pilot's checklist before take-off: problems are found on the ground, not in the air.*

### 6.2 The files

| File                                | What it does                                         |
|-------------------------------------|------------------------------------------------------|
| `src/config/env.validation.ts`      | `EnvironmentVariables` (the rules) + `validateEnv()` |
| `src/config/env.validation.spec.ts` | 7 unit tests (no app, no DB needed)                  |
| `src/app.module.ts`                 | `ConfigModule.forRoot({ …, validate: validateEnv })` |
| `src/main.ts`                       | reads `PORT` from the validated config, typed        |

The rules: a **DTO for the environment**, same decorators as request DTOs (`notes/08` §2):
```ts
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;      // default when missing

  @Max(65535)
  @Min(1)
  @IsInt()                                      // checked FIRST (see 6.4)
  PORT: number = 3000;

  @Matches(/^postgres(ql)?:\/\//, { message: 'DATABASE_URL must start with postgres:// or postgresql://' })
  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is missing' })   // no default: no DB = no app
  DATABASE_URL: string;
}
```
And the check:
```ts
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true }); // "3000" → 3000
  const errors = validateSync(env, { stopAtFirstError: true });                                  // one msg per var
  if (errors.length > 0) {
    const problems = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(`Invalid environment variables:\n  - ${problems.join('\n  - ')}`);
  }
  return env;   // ConfigService serves these checked, converted values from now on
}
```
Reading `PORT` in `main.ts`, typed:
```ts
const config: ConfigService<EnvironmentVariables, true> = app.get(ConfigService);
await app.listen(config.get('PORT', { infer: true }));   // TypeScript knows it's a number
```

### 6.3 Real output

Starting the real built app with a broken env (`DATABASE_URL= PORT=abc NODE_ENV=staging node dist/main.js`):
```
[Nest] …   LOG [NestFactory] Starting Nest application...
[Nest] … ERROR [ExceptionHandler] Error: Invalid environment variables:
  - NODE_ENV must be one of the following values: development, production, test
  - PORT must be an integer number
  - DATABASE_URL is missing
exit code: 1
```
- It stopped **before** opening the port, and listed **all three** problems at once.
- Exit code **1** = failure. A deploy platform (Day 27) sees that and keeps the old version running.
- `DATABASE_URL=` on the command line **beat** the value in `.env`: ConfigModule gives the real environment
  priority over the `.env` file. That's how production sets secrets: as real env vars, never a committed file.

The unit tests feed `validateEnv()` plain objects (all strings, like real env vars). Every message, real output:
```
{"PORT":"abc"}               → PORT must be an integer number
{"PORT":"70000"}             → PORT must not be greater than 65535
{"PORT":"3.5"}               → PORT must be an integer number
{"DATABASE_URL":""}          → DATABASE_URL is missing
{"DATABASE_URL":"mysql://…"} → DATABASE_URL must start with postgres:// or postgresql://
{}  (only a valid DATABASE_URL) → ok, PORT = 3000, NODE_ENV = development (the defaults)
```
`npm test` → **10 passed** (3 old + 7 new). `npm run test:e2e` → **24 passed**.

### 6.4 Two real gotchas we hit while building it

**a) `Reflect.getMetadata is not a function`.** The first unit-test run failed 7/7 with this. Converting `"4000"` to
a number needs the field's TypeScript type, which `class-transformer` reads from decorator metadata via
`reflect-metadata`. Inside the Nest app, Nest loads that package for us; a unit test of one file doesn't. Fix:
`import 'reflect-metadata';` at the top of `env.validation.ts`.

**b) Decorator order matters with `stopAtFirstError`.** The first version had `@IsInt()` on **top**. Real output:
```
{"PORT":"abc"} → PORT must not be greater than 65535      ← true, but useless!
```
Decorators are applied **bottom-up**, so class-validator checks the one **closest to the field first**, and
`stopAtFirstError` keeps only that first failure. `Number('abc')` is `NaN`, and `@Max` ran first. Fix: the most
basic rule goes at the **bottom** (`@IsInt()`, `@IsNotEmpty()`). After the fix: `PORT must be an integer number`.

### 6.5 🗣️ Explain back (try first, then open)

**1. Why does a bad `.env` stop the app at startup, instead of failing on the first request?**
<details><summary>✅ Answer</summary>

`ConfigModule.forRoot({ validate: validateEnv })` runs `validateEnv` once while the app is being created
(`NestFactory.create`), before any route exists. It throws, so creating the app fails, Nest logs the message and the
process exits with code 1. Nothing starts listening, so no user ever hits a half-configured app.
</details>

**2. Why is `PORT` a number in `main.ts`, when every env var is a string?**
<details><summary>✅ Answer</summary>

`plainToInstance(..., { enableImplicitConversion: true })` converts each value to the field's TypeScript type
(`PORT: number` → `Number("3000")`), and `validateEnv` returns that converted object. ConfigModule then serves
those values, so `config.get('PORT')` gives `3000`, not `"3000"`. `ConfigService<EnvironmentVariables, true>` with
`{ infer: true }` also tells TypeScript it's a number.
</details>

**3. `PORT=abc` first said "must not be greater than 65535". Why, and what fixed it?**
<details><summary>✅ Answer</summary>

Decorators are applied bottom-up, so class-validator checked `@Max` (closest to the field) first, and
`stopAtFirstError` kept only that first failure (`NaN <= 65535` is false). Moving `@IsInt()` to the bottom makes the
basic "is it a whole number?" check run first.
</details>

---

*Day 11 done ✅. Next: Day 12, testing (unit tests with mocks, e2e, a test-DB strategy).*

## 📝 Revision Q&A

**Q1. ★ What are custom providers? Give a real use for each kind.**
<details><summary>✅ Answer</summary>

A provider is a token plus a recipe for how Nest builds it. `useClass` creates a class instance, for example a
`FakeMailer` in development and an `SmtpMailer` in production behind the same `Mailer` token. `useValue` hands over a
ready value: constants, a config object, or a fake object in unit tests (we use `{ provide: PrismaService, useValue: {} }`).
`useFactory` runs a function, possibly async, that can receive other providers through `inject`, for example building
a DB client from `ConfigService`. `useExisting` makes an alias, so two tokens share one instance.
</details>

**Q2. Why can't an interface be an injection token?**
<details><summary>✅ Answer</summary>

TypeScript interfaces are erased at compile time, so at runtime there's nothing for Nest to look up. Use a class
(often an abstract class), or a string/Symbol token with `@Inject(TOKEN)`.
</details>

**Q3. ★ What is a dynamic module? `forRoot` vs `register` vs `forFeature`? Why `…Async`?**
<details><summary>✅ Answer</summary>

A dynamic module is a module you configure when you import it: a static method returns a `DynamicModule` object
(`module`, `providers`, `exports`, optionally `imports` and `global`), usually with the options registered as a
`useValue` provider. By convention `forRoot` configures something once for the whole app (like `ConfigModule.forRoot()`),
`register` configures it per import, and `forFeature` adds a feature's pieces to an already-configured root, like
`TypeOrmModule.forFeature([User])`. The `…Async` versions take a `useFactory` with `inject`, because options usually
come from `ConfigService` at startup, not from constants known when the file is loaded.
</details>

**Q4. ★ How do you handle a circular dependency in Nest?**
<details><summary>✅ Answer</summary>

First I'd ask whether the cycle should exist at all: usually the fix is to extract the shared logic into a third
service, or to replace one direction with an event. If it really must stay, use `forwardRef` on both sides:
`@Inject(forwardRef(() => OtherService))` for providers and `imports: [forwardRef(() => OtherModule)]` for modules.
In an ESM project the circular imports also break while the files load ("Cannot access X before initialization"),
because the decorator metadata reads the class too early, so the constructor parameter type also needs a wrapper type
that the compiler emits as `Object`. And never use the other service inside a constructor in a circular pair.
</details>

**Q5. ★ How do you manage and validate configuration in a Nest app?**
<details><summary>✅ Answer</summary>

With `@nestjs/config`: `ConfigModule.forRoot({ isGlobal: true })` loads `.env` plus the real environment (the real
environment wins), and services inject `ConfigService` instead of reading `process.env` directly. I validate
everything once at startup with a `validate` function (or a schema): a class with class-validator rules, converted
with `plainToInstance`, so the app fails fast with a clear list of what's missing, and gets typed, converted values
like a numeric `PORT`. Secrets come from the environment or a secret manager in production, never from a committed
file. For libraries that need config, I use their `…Async` dynamic-module form with a factory that injects `ConfigService`.
</details>

## ⚠️ Interview traps

| They say…                                 | You say…                                             |
|-------------------------------------------|------------------------------------------------------|
| "Inject an interface: `(m: IMailer)`."    | Interfaces vanish at runtime. Use a class/token      |
| "A string token works without `@Inject`." | Only class types are saved. Use `@Inject('X')`       |
| "`useExisting` makes a copy."             | It's an alias: the **same** instance                 |
| "A factory runs on every injection."      | Once (singleton), at startup; async is awaited       |
| "A dynamic module is special magic."      | It's an object: `module`, `providers`, `exports`     |
| "`forwardRef` on one side is enough."     | Both sides; in ESM also a wrapper type               |
| "Circular deps are fine with forwardRef." | It's a band-aid. Extract a 3rd service or use events |
| "Read `process.env.X` anywhere."          | Validate once at startup, inject `ConfigService`     |
| "`.env` overrides the real environment."  | The real environment wins; prod uses real env vars   |
| "Decorator order doesn't matter."         | With `stopAtFirstError`, the bottom one runs first   |
