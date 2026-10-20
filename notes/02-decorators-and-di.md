# 02 · Decorators & Dependency Injection (DI)

> **The whole chapter in one line:**
> A **decorator** is a sticker (a function) that tells Nest *what* a class is.
> **DI** means *"apne helpers khud mat banao, maang lo"*: you **ask** for them in the constructor, and Nest **delivers** them.

Demos to run (plain JS, so Node can run them directly):
```bash
node playground/decorators-di/01-decorators.js
node playground/decorators-di/02-mini-di.js
```

---

# Part A · Decorators 🏷️

## 1. What is a decorator?

- Syntax: `@Something` written **above** a class, method, parameter or property.
- **Simple si baat:** a decorator is just a **function**. TypeScript calls it for you.
- 🧠 **Memory hook:** **sticker on a box.** The box (your class) stays the same, but the sticker tells
  the delivery guy (Nest) what to do with it: "Fragile", "This side up", "Controller for /health".

## 2. Two kinds of decorators

| Kind | What it does | Example |
|---|---|---|
| 🏷️ **Sticker** (metadata) | Only **adds information**; doesn't change your code | `@Controller('health')`, `@Get()`, `@Injectable()` |
| 🎁 **Wrapper** (behaviour) | **Wraps** the method and adds extra work before/after | a custom `@Log` that times every call |

Most Nest decorators are **stickers**. Nest **reads** the stickers at startup and builds the app from them.

## 3. When does a decorator run? ⏰ (a favourite interview question)

**Once, when the class is defined, not when you call the method.**
In the demo, `[Get] sticker on hello()` prints **before** any object is created. Class bani, sticker lag gaya. Bas.

## 4. Why `@Get('/hello')` has brackets: decorator **factory**

`Get('/hello')` is a function that **returns** the real decorator. You pass options through the brackets.
So `@Get('/hello')` = "call `Get('/hello')`, then use what it returns as the decorator".

## 5. Where can you put decorators? (the Nest cheat sheet)

| Where | Nest examples | Meaning |
|---|---|---|
| **Class** | `@Module`, `@Controller('users')`, `@Injectable()`, `@Global()` | "What is this class?" |
| **Method** | `@Get()`, `@Post()`, `@HttpCode(204)`, `@UseGuards(...)` | "Which route? Which extra rules?" |
| **Parameter** | `@Body()`, `@Param('id')`, `@Query()`, `@Headers()` | "Which part of the request goes into this argument?" |
| **Property** | `@IsEmail()`, `@MinLength(8)` (class-validator, in DTOs) | "Rules for this field" |
| **Custom** | `@CurrentUser()`, `@Roles('admin')` (coming in Week 4) | Your own stickers |

## 6. Under the hood: real code from YOUR project 🔍

You wrote this in `src/health/health.controller.ts`:
```ts
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
```
TypeScript compiled it into this, in `dist/health/health.controller.js`:
```js
HealthController = __decorate([
    Controller('health'),                              // ← your sticker, now a normal function call
    __metadata("design:paramtypes", [PrismaService])   // ← ⭐ THE MAGIC LINE
], HealthController);
```
⭐ `design:paramtypes` = "this constructor needs a **PrismaService**". TypeScript writes this line because
`tsconfig.json` has `emitDecoratorMetadata: true`. **This is how Nest knows what to inject.**
(TypeScript types normally disappear after compiling. This setting saves them as runtime data.)

---

# Part B · Dependency Injection 💉

## 7. The problem without DI 😩

```ts
class HealthController {
  private prisma = new PrismaService();   // ❌ making my own helper
}
```

| Problem | Why it hurts |
|---|---|
| 🔗 **Tight coupling** | The controller must know *how* to build PrismaService (which needs ConfigService, which needs…). |
| 🧪 **Hard to test** | You can't swap in a fake DB. Your tests hit the real database. |
| 👯 **Many copies** | Each `new` = another DB connection pool. 10 classes = 10 pools. 💥 |

## 8. DI: just ask for it ✋

```ts
constructor(private readonly prisma: PrismaService) {}   // ✅ "I need a PrismaService"
```
- 🧠 **Memory hook (HR manager):** *"Don't hire your own helpers. HR (Nest) sends them."*
  You say **what** you need, and HR decides **how** to create it and **who** gets it.
- **IoC (Inversion of Control):** normally *your code* controls `new`. With IoC, the **framework** controls
  object creation and calls your code when needed. It's the Hollywood principle: *"Don't call us, we'll call you."* 📞
- **DI is one way to do IoC.** Interviewers like this one line.

## 9. How Nest does DI, in 4 steps

1. `@Injectable()` marks the class as "Nest can create this".
2. TypeScript writes `design:paramtypes = [PrismaService]` (step 6 above).
3. Nest reads the module list (`providers`, `imports`, `exports`) and builds a **dependency graph**:
   *HealthController → PrismaService → ConfigService*.
4. It creates them **bottom-up** (ConfigService first), **caches** each one, and injects it everywhere.

👉 That's exactly what `02-mini-di.js` does in about 15 lines. Output:
```
creating ConfigService
creating PrismaService with [ConfigService]
creating HealthController with [PrismaService]
creating UsersController with [PrismaService]     ← PrismaService NOT created again
same PrismaService object shared? true            ← singleton ✅
```

## 10. Token: the "name tag" 🔖

- To find a provider, Nest uses a **token**. By default **the class itself** is the token (`PrismaService`).
- ⚠️ **TypeScript interfaces vanish at runtime**, so you **can't** inject an interface by type.
  Use a string or symbol token instead:
  ```ts
  providers: [{ provide: 'MAILER', useClass: SmtpMailer }]
  constructor(@Inject('MAILER') private mailer: Mailer) {}
  ```

## 11. Module rules 📦 (where the famous error comes from)

| Key | Meaning |
|---|---|
| `providers` | What this module **creates** |
| `exports` | What it **shares** with modules that import it |
| `imports` | Other modules whose **exports** I want to use |
| `@Global()` | Share my exports with **everyone**, no import needed (use rarely: DB, config) |

😱 **The most common Nest error** (worded roughly like this):
> `Nest can't resolve dependencies of the HealthController (?). Please make sure that the argument PrismaService at index [0] is available in the HealthModule context.`

**Matlab:** "HealthController asked for PrismaService, but nobody in HealthModule's reach provides it."
**Fix checklist:**
1. Is it in some module's `providers`?
2. Is that module **exporting** it?
3. Does *this* module **import** that module (or is it `@Global`)?
4. Did you use `import type { PrismaService }`? ❌ That erases the type, the metadata becomes `Object`, and DI breaks. Use a normal import.

## 12. Scopes: how many copies? 👯

| Scope | Copies | When |
|---|---|---|
| **DEFAULT (singleton)** | **One** for the whole app | 99% of the time. Fast. |
| **REQUEST** | A new one **per HTTP request** | Per-request data (e.g. a tenant ID) |
| **TRANSIENT** | A new one **for each class that asks** | Rare (e.g. a logger with its own context) |

⚠️ **Real bug alert:** services are singletons, so **never store per-request data in a service field**
(`this.currentUser = …`). User A and User B share the same object, so A could see B's data! 😱
⚠️ A REQUEST-scoped provider makes **everything that depends on it** request-scoped too (it "bubbles up"),
and that's slower.

## 13. Circular dependency 🔄

`UsersService` needs `OrdersService`, and `OrdersService` needs `UsersService`. Nest gets stuck: which one to create first?
- Quick fix: `@Inject(forwardRef(() => OrdersService))` (and `forwardRef(() => OrdersModule)` in `imports`).
- **Better fix:** **refactor.** Move the shared logic into a third service that both use. A circular dependency usually means bad design.

## 14. Custom providers (preview for Day 11)

| Recipe | Meaning | Example use |
|---|---|---|
| `useClass` | "When someone asks for X, create class Y" | Real vs fake mailer |
| `useValue` | "Give this ready-made value" | Config object, test mocks |
| `useFactory` | "Run this function to build it" (can be async, can inject deps) | DB client that needs config |
| `useExisting` | "X is just another name for Y" | Aliases |

## 15. Lifecycle hooks + `enableShutdownHooks` 🔌

Nest calls these methods **automatically** (IoC again: "we'll call you"):
```
STARTUP:   NestFactory.create (objects created)  →  app.listen():  onModuleInit  →  onApplicationBootstrap  →  port opens 🟢
SHUTDOWN:  signal (Ctrl+C / SIGTERM)  →  onModuleDestroy  →  beforeApplicationShutdown  →  onApplicationShutdown
```
- Our `PrismaService` uses `onModuleInit` to **connect** and `onModuleDestroy` to **disconnect**.
- **`app.enableShutdownHooks()`** (in `main.ts`) makes Nest **listen for stop signals** like SIGINT (Ctrl+C) and
  SIGTERM, and run the shutdown hooks. **Without it**, the process just dies, and the DB connections aren't closed properly.
- 🚀 **DevOps link:** when you deploy a new version, the platform or Kubernetes sends **SIGTERM** to the old app,
  waits a bit (Kubernetes: 30 s by default), then force-kills it. Shutdown hooks = **graceful shutdown**:
  finish open work, close connections, then exit. *Dukaan band karne se pehle hisaab-kitaab poora karo.* 🧾

## 16. The real superpower: testing 🧪

```ts
const moduleRef = await Test.createTestingModule({ controllers: [HealthController], providers: [PrismaService] })
  .overrideProvider(PrismaService)
  .useValue({ $queryRaw: vi.fn().mockResolvedValue([1]) })   // fake DB, no Postgres needed
  .compile();
```
The same idea as `testApp.override(...)` in the demo. Because of DI, swapping is **one line**. (Day 12)

---

## 🎤 Interview answers (practise saying these out loud)

**Q: What is a decorator?**
> A decorator is a function, applied with `@`, that attaches metadata or extra behaviour to a class,
> method, parameter or property. It runs once, when the class is defined. In Nest most decorators,
> like `@Controller` and `@Get`, just add metadata, and Nest reads it at startup to build routes and wire up the app.

**Q: What is dependency injection, and why use it?**
> With DI, a class doesn't create its own dependencies. It declares them in the constructor, and the framework
> provides them. This is a form of inversion of control. The benefits: loose coupling, easy testing
> (I can inject a fake), and shared singleton instances, so for example one DB connection pool for the whole app.

**Q: How does Nest know what to inject?**
> With `emitDecoratorMetadata`, TypeScript saves the constructor parameter types as metadata (`design:paramtypes`).
> Nest reads it via `reflect-metadata`, builds a dependency graph from the modules, creates providers
> bottom-up as singletons, and injects them. For interfaces or values, which don't exist at runtime, we use custom tokens with `@Inject()`.

**Q: "Nest can't resolve dependencies…": how do you fix it?**
> It means the provider isn't available in that module's context. I check that it's in some module's `providers`,
> that the module exports it, and that my module imports that module. I also check I didn't use `import type`,
> which erases the metadata.

**Q: What are provider scopes?**
> Default is singleton: one instance for the whole app. Request scope creates one per request and bubbles up
> to everything that depends on it, which costs performance. Transient gives each consumer its own instance.
> Because of singletons, you must never keep per-request state in a service's fields.

## ⚠️ Interview traps

| They say… | You say… |
|---|---|
| "Decorators run every time the method is called?" | No. They run **once at class definition**. (A *wrapper* decorator's inner function runs on each call.) |
| "Inject it by its interface type." | Interfaces **don't exist at runtime**. Use a token with `@Inject('TOKEN')`. |
| "Store the logged-in user in `this.user` in the service." | ❌ The service is a **singleton** shared by all requests, so data leaks between users. |
| "Fix the circular dependency with `forwardRef` everywhere." | `forwardRef` is a band-aid. **Refactor** the shared logic into a third service. |
| "`import type` is always better for TypeScript." | Not for injected classes. It **breaks DI** (the metadata becomes `Object`). |
| "Is DI the same as IoC?" | IoC is the general idea (the framework controls flow). DI is one **way** to do IoC. |
| "Nest uses the new standard JS decorators?" | Nest uses TypeScript's **legacy** `experimentalDecorators` (see `tsconfig.json`), which support parameter decorators and metadata. |
