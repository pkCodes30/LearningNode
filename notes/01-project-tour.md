# 01b · Project Tour: How the App Starts (Day 1)

> **The whole tour in one line:**
> `main.ts` **opens the restaurant**, `AppModule` is the **master list**, and Nest's **manager** (DI)
> hires everyone and hands each worker the helpers they need.

---

## 1. The restaurant map 🍽️

| Nest piece | Restaurant role | In our code |
|---|---|---|
| `main.ts` | The owner who **opens the shop** in the morning | `src/main.ts` |
| **Module** | A **department** (with a list of its people) | `AppModule`, `HealthModule`, `PrismaModule` |
| **Controller** | The **reception counter**: takes a request at one URL, gives the reply | `AppController` (`/`), `HealthController` (`/health`) |
| **Service / Provider** | The **worker in the back** who does the real work | `AppService`, `PrismaService` |
| **DI container** | The **manager / HR**: creates everyone and gives each person their helpers | Nest itself |
| **Decorator** (`@…`) | A **sticker** on a class or method that tells Nest what it is | `@Module`, `@Controller`, `@Get`, `@Injectable` |

## 2. Startup timeline ⏱️

```
npm run start:dev
 └─ Nest CLI: TypeScript → JavaScript (dist/) → runs  node dist/main.js
     └─ main.ts → bootstrap()
         ├─ NestFactory.create(AppModule)      ← reads the master list and CREATES every object (DI wiring)
         │   ├─ ConfigModule  → reads .env → ConfigService
         │   ├─ PrismaModule  → PrismaService (gets ConfigService)
         │   ├─ HealthModule  → HealthController (gets PrismaService)
         │   └─ AppController (gets AppService)
         ├─ useGlobalPipes(ValidationPipe)     ← a checker for all incoming data
         ├─ enableShutdownHooks()              ← clean exit on Ctrl+C / SIGTERM
         └─ app.listen(3000)
             ├─ app.init() → lifecycle hooks: onModuleInit → PrismaService DB CONNECT 🔌
             └─ opens port 3000                ← SERVER ON 🟢
```

## 3. A request's journey: `GET /health` 🚶

```
curl localhost:3000/health
 → Nest router finds  @Controller('health') + @Get()
 → HealthController.check()
 → prisma.$queryRaw`SELECT 1`   (asks Postgres: "are you alive?")
 → returns { status: 'ok', database: 'up' }  → Nest sends it as JSON, status 200
 (DB down? → the query throws → Nest sends 500 automatically)
```

## 4. Key lines to remember 🔑

| Line | Meaning |
|---|---|
| `NestFactory.create(AppModule)` | Build the whole app from the master list |
| `app.listen(process.env.PORT ?? 3000)` | **This line starts the server.** `??` = "if PORT is empty, use 3000" |
| `await bootstrap();` | Top-level `await`, allowed because this project is **ESM** |
| `import … from './app.module.js'` | `.js`, not `.ts`, because after compiling the file *is* `.js` (ESM needs full names) |
| `constructor(private readonly x: XService)` | "I need an XService": Nest gives it automatically (**DI**) |
| `@Global()` + `exports` | Share PrismaService with **every** module without importing it again |
| `config.getOrThrow('DATABASE_URL')` | No DB URL? **Crash at startup** (fail fast, which is good) |
| `onModuleInit` / `onModuleDestroy` | Nest calls these automatically: connect at start (inside `app.listen()`, just before the port opens), disconnect at shutdown |

## 5. ValidationPipe options (main.ts)

| Option | Simple meaning |
|---|---|
| `whitelist: true` | Only allow fields declared in the DTO (the data-shape class) |
| `forbidNonWhitelisted: true` | Extra field sent? → **400 error** (instead of silently dropping it) |
| `transform: true` | Convert plain JSON into the DTO class and fix types (`"5"` → `5`) |

🛡️ Why it matters: someone can't sneak `"isAdmin": true` into a signup request (the **mass assignment** attack).

## 6. DI in one line 💉

> A class **doesn't create its own helpers** (`new PrismaService()`). It **asks for them in the constructor**,
> and Nest creates them **once** and hands them in.
> Benefit: easy to **swap in a fake for tests**, and one shared instance (e.g. one DB connection pool).

🧠 **Memory hook:** "Don't hire your own helpers. HR (Nest) sends them."

## 7. Interview answers 🎤

**Q: What happens when a NestJS app starts?**
> `main.ts` calls `NestFactory.create` with the root module. Nest reads the module tree, creates all
> providers and controllers, and injects their dependencies. Then we set global things like the
> ValidationPipe. When we call `app.listen`, Nest first runs lifecycle hooks like `onModuleInit`
> (that's where we connect to the database), and then opens the HTTP port.

**Q: Controller vs service?**
> The controller only handles HTTP: the route, reading the request, sending the response. The service holds the
> business logic. Keeping them separate makes the logic reusable and easy to unit-test without HTTP.

**Q: What is a health-check endpoint for?**
> Load balancers, Kubernetes and hosting platforms call it regularly to check that the app *and* its
> dependencies (like the DB) are working. If it fails, they stop sending traffic or restart the app.

**Q: `providers` vs `exports` in a module?**
> `providers` = what this module **creates**. `exports` = what it **shares** with modules that import it.

## ⚠️ Interview traps

| They say… | You say… |
|---|---|
| "So the controller should talk to the DB directly?" | No. Controller → service → DB. Keep HTTP and logic separate. |
| "Make every module `@Global`, it's easier!" | Only for truly shared things (DB, config). Too many globals hide dependencies. |
| "Missing env var? Just default it to something." | Required config should **fail fast at startup** (`getOrThrow`), not break later in production. |
| "`??` and `\|\|` are the same?" | `??` only falls back on `null`/`undefined`; `\|\|` also falls back on `0`, `''` and `false`. |
