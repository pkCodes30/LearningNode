# 04 · Nest Decorators: the full toolkit 🧰

> **The whole chapter in one line:**
> Every Nest decorator answers one of 4 questions: **Kaun? Kahan? Kya? Kaise?**
> *Who is this class? Which URL? Which data? How do we check it?* Learn them family by family, and Nest becomes easy.

📌 First read [02-decorators-and-di.md](02-decorators-and-di.md) for **how** decorators and DI work.
This chapter covers **which** decorators you'll use this month, each with a real example and real output.

**Demos** (TypeScript, because Node can't run decorator syntax yet, so compile once and then run):
```bash
npx tsc -p playground/nest-decorators                      # compile all demos → playground/nest-decorators/dist/
node playground/nest-decorators/dist/01-injectable.js       # @Injectable, @Inject, @Optional
node playground/nest-decorators/dist/02-routes-params.js    # @Get… @Param @Query @Body @Res…
node playground/nest-decorators/dist/03-dtos.js             # @IsEmail @Type @Exclude…
node playground/nest-decorators/dist/04-enhancers-custom.js # @UseGuards, @Roles, @CurrentUser…
```
Each demo boots a mini Nest app with **the same global ValidationPipe as `src/main.ts`**, sends requests,
and prints `request → status body`. All outputs below are copied from real runs.

---

## 0. The big map 🗺️ (7 families)

🧠 **Memory hook: Kaun → Kahan → Kya → Kaise**

**What each family is for:**

| #   | Family             | Sits on           | Answers                             | Day       |
|-----|--------------------|-------------------|-------------------------------------|-----------|
| 1   | 🏗️ Building blocks | class             | **Kaun?** What is this class?       | 1, 8      |
| 2   | 💉 DI helpers      | constructor param | Which thing do I inject?            | 8, 11     |
| 3   | 🛣️ Routes          | method            | **Kahan?** Which URL? Which status? | 8–9       |
| 4   | 📥 Request data    | method param      | **Kya?** Which part of the request? | 9         |
| 5   | 📋 DTO rules       | class property    | **Kaise?** Is the input valid?      | 9, 13     |
| 6   | 🛡️ Enhancers       | class or method   | What runs before, after, on error?  | 10, 22–23 |
| 7   | ✍️ Custom          | anywhere          | Make your own sticker               | 22–23     |

**The decorators in each family:**

| Family             | Decorators                                                                         |
|--------------------|------------------------------------------------------------------------------------|
| 🏗️ Building blocks | `@Module` `@Controller` `@Injectable` `@Global`                                    |
| 💉 DI helpers      | `@Inject` `@Optional` `forwardRef`                                                 |
| 🛣️ Routes          | `@Get` `@Post` `@Put` `@Patch` `@Delete` `@HttpCode` `@Header` `@Redirect`         |
| 📥 Request data    | `@Param` `@Query` `@Body` `@Headers` `@Ip` `@Req` `@Res`                           |
| 📋 DTO rules       | `@IsEmail` `@MinLength` `@Type` `@Transform` `@Exclude` `@Expose` …                |
| 🛡️ Enhancers       | `@UseGuards` `@UseInterceptors` `@UsePipes` `@UseFilters` `@Catch`                 |
| ✍️ Custom          | `SetMetadata` `Reflector.createDecorator` `createParamDecorator` `applyDecorators` |

---

# Family 1 · 🏗️ Building blocks (Kaun?)

## 1. The four class decorators

| Decorator               | Meaning                                                    |
|-------------------------|------------------------------------------------------------|
| `@Module({...})`        | A **box** that groups related controllers and providers    |
| `@Controller('health')` | "I handle requests that start with `/health`"              |
| `@Injectable()`         | "Nest can **create** me and **inject** my dependencies"    |
| `@Global()`             | "Share my exports with **every** module, no import needed" |

See them in real code: [app.module.ts](../src/app.module.ts) · [health.controller.ts](../src/health/health.controller.ts) ·
[prisma.service.ts](../src/prisma/prisma.service.ts) · [prisma.module.ts](../src/prisma/prisma.module.ts)

`@Module` has 4 keys: **imports** (modules I need), **controllers** (who handles requests),
**providers** (what I create), **exports** (what I share). Details are in 02, section 11.

## 2. `@Injectable()`: what does it *actually* do? 🔍

It has two jobs:
1. It marks the class as a **provider** that Nest's DI container can create.
2. ⭐ Because the class now has a decorator, TypeScript writes the constructor's parameter types
   (`design:paramtypes`) into the compiled code. **That metadata is how Nest knows what to inject.**
   No decorator means no metadata.

Demo 1 has two services **without** `@Injectable()`:
```ts
class NoDepsService {                                       // no @Injectable, NO constructor deps
  hello() { return 'NoDepsService: works fine'; }
}

class ForgotService {                                       // ❌ no @Injectable, but it HAS a dep
  constructor(private readonly clock: ClockService) {}
  hello() { return `ForgotService: time is ${this.clock.now()}`; }
}
```

🤔 **Predict first:** will the app even start? And what does each `hello()` print?

<details><summary>👀 Real output + why</summary>

```
GoodService: time is 10:30
NoDepsService: works fine
TokenService: ShopLite started at 10:30, mailer = undefined
one shared ClockService? true
ForgotService: 💥 Cannot read properties of undefined (reading 'now')
```
- **The app starts fine!** 😱 No error at startup.
- `ForgotService` has no metadata, so Nest thinks "no dependencies" and calls `new ForgotService()`.
  `this.clock` is `undefined`, and the code crashes **later, when a request uses it**. *Ye bug dhoondhna mushkil hai.*
- `NoDepsService` works, because there is nothing to inject.
- ✅ **Rule:** always put `@Injectable()` on every service, even with no deps. It's safe for the day you add one.
</details>

Options: `@Injectable({ scope: Scope.REQUEST })` changes how many copies exist (02, section 12).

---

# Family 2 · 💉 DI helpers

## 3. `@Inject(token)`: when the type alone isn't enough

Nest injects **by class**. But what if the thing is a string, a config object, or an interface?
Interfaces vanish at runtime, so there's no class to look up. Then you give it a **token** (a name tag 🔖)
and use `@Inject(token)`.

```ts
const APP_NAME = 'APP_NAME';                 // a string token
const STARTED_AT = Symbol('STARTED_AT');     // a symbol token (can't clash by accident)

@Module({
  providers: [
    { provide: APP_NAME, useValue: 'ShopLite' },                       // a ready-made value
    { provide: STARTED_AT, useFactory: (clock: ClockService) => clock.now(), inject: [ClockService] },
  ],
})

@Injectable()
class TokenService {
  constructor(
    @Inject(APP_NAME) private readonly appName: string,
    @Inject(STARTED_AT) private readonly startedAt: string,
    @Optional() @Inject('MAILER') private readonly mailer?: { send(): void },
  ) {}
}
```
Output: `TokenService: ShopLite started at 10:30, mailer = undefined`

💡 Tip: keep tokens in **constants** (like `APP_NAME` above). A typo in a raw string (`'APP_NAEM'`) is a silent bug.

## 4. `@Optional()`: "if nobody provides it, give me `undefined`"

- **With** `@Optional()`: nobody provides `'MAILER'`, so you get `mailer = undefined` (see the output above). No crash.
- **Without** `@Optional()` (the `StrictService` in demo 1), you get the famous error:
  ```
  StrictService: 💥 Nest can't resolve dependencies of the StrictService (?). Please make sure that
  the argument "MAILER" at index [0] is available in the StrictModule module.
  ```
  How to read it: `(?)` marks **which** argument is missing, and `index [0]` means the **first** constructor argument.
- Use it for truly optional features, like a mailer that isn't configured in dev. Then handle `undefined` in your code.

## 5. `forwardRef(() => X)`

This one is for circular dependencies (A needs B, and B needs A). It's a band-aid. The real fix is to refactor (02, section 13).

---

# Family 3 · 🛣️ Route decorators (Kahan?)

## 6. HTTP method decorators

| Decorator        | Use for                 | Default status |
|------------------|-------------------------|----------------|
| `@Get(path?)`    | read                    | 200            |
| `@Post(path?)`   | create                  | **201**        |
| `@Put(path?)`    | replace the whole thing | 200            |
| `@Patch(path?)`  | update some fields      | 200            |
| `@Delete(path?)` | delete                  | 200            |

**Full URL = controller prefix + method path.**
`@Controller('products')` + `@Get(':id')` → `GET /products/:id`. The `:id` part is a **route parameter** (a placeholder).

## 7. `@HttpCode`, `@Header`, `@Redirect`

```ts
@Post(':id/archive')
@HttpCode(200)                          // nothing new is created, so 200 fits better than 201
archive(@Param('id', ParseIntPipe) id: number) { return { archived: id }; }

@Delete(':id')
@HttpCode(204)                          // "done, nothing to send back"
remove(@Param('id', ParseIntPipe) id: number) { return { deleted: id }; }   // ignored!

@Get('headers')
@Header('Cache-Control', 'no-store')    // a fixed response header

@Get('old-docs')
@Redirect('/products', 301)             // permanent redirect
```
Real output:
```
POST   /products              → 201 {"created":{"name":"Pen","price":10}}     ← POST default
POST   /products/7/archive    → 200 {"archived":7}                            ← @HttpCode(200)
DELETE /products/7            → 204 (empty body)                              ← return value dropped: 204 has no body
GET    /debug/headers         → 200 {...}  [cache-control: no-store]
GET    /debug/old-docs        → 301 Moved Permanently. Redirecting to /products  [location: /products]
```

## 8. 🤔 Puzzle: route ORDER

```ts
@Controller('products')
class ProductsController {
  @Get(':id')     findOne(@Param('id', ParseIntPipe) id: number) {...}
  @Get('search')  search(@Query('q') q: string) {...}      // declared AFTER ':id'
}
```
**Predict:** what does `GET /products/search?q=pen` return?

<details><summary>👀 Real output + why</summary>

```
GET /products/search?q=pen → 400 {"message":"Validation failed (numeric string is expected)","error":"Bad Request","statusCode":400}
```
- Routes are matched **top to bottom**. `:id` matches **anything**, including the word `search`.
  So the request goes to `findOne`, and `ParseIntPipe` fails on `"search"`.
- ✅ **Fix:** put fixed paths **above** `:id`. *Pehle specific, phir generic.*
</details>

---

# Family 4 · 📥 Request-data decorators (Kya?)

## 9. Which part of the request goes where

```
POST /products/42?sort=price      header  x-request-id: abc        body  {"name":"Pen"}
              └─┬┘ └────┬───┘             └──────┬───────┘                └─────┬──────┘
          @Param('id')  @Query('sort')     @Headers('x-request-id')            @Body()
```

| Decorator                  | Gives you                       | Example value                  |
|----------------------------|---------------------------------|--------------------------------|
| `@Param('id')`             | one **path** part               | `'42'`                         |
| `@Query('page')`           | one query value                 | `'2'`                          |
| `@Query()`                 | the whole query object          | `{ page: '2', sort: 'price' }` |
| `@Body()`                  | the parsed JSON body            | `{ name: 'Pen' }`              |
| `@Body('email')`           | one field of the body           | `'a@b.com'`                    |
| `@Headers('x-request-id')` | one header (**lowercase** name) | `'abc-123'`                    |
| `@Ip()`                    | the client's IP                 | `'::1'` (IPv6 localhost)       |
| `@Req()`                   | the whole Express request       | use rarely                     |
| `@Res()`                   | the whole Express response      | ⚠️ trap, see section 12        |

⚠️ **Everything in the URL is a STRING.** Writing `id: number` in TypeScript does **not** convert it.
TypeScript types disappear at runtime. Something must convert it: a **pipe**.

## 10. Pipes inside param decorators

The 2nd, 3rd… arguments are **pipes**. They run **left → right**:
```ts
@Get()
list(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,   // missing → 1, then "2" → 2
  @Query('sort') sort?: string,
) { return { page, typeofPage: typeof page, sort: sort ?? null }; }

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) { return { id, typeofId: typeof id }; }
```
Output:
```
GET /products                    → 200 {"page":1,"typeofPage":"number","sort":null}      ← DefaultValuePipe
GET /products?page=2&sort=price  → 200 {"page":2,"typeofPage":"number","sort":"price"}   ← "2" became 2
GET /products/42                 → 200 {"id":42,"typeofId":"number"}
```
Built-in pipes: `ParseIntPipe`, `ParseFloatPipe`, `ParseBoolPipe`, `ParseUUIDPipe`, `ParseEnumPipe`,
`ParseArrayPipe`, `ParseDatePipe`, `DefaultValuePipe`.

## 11. 🤔 Puzzle: `?page=abc`

Same `list()` as above. **Predict:** `GET /products?page=abc` gives a 400 or a 200?

<details><summary>👀 Real output + why (this one surprised me too)</summary>

```
GET /products?page=abc  → 200 {"page":1,"typeofPage":"number","sort":null}
```
- **Global pipes run first**, then the param's own pipes.
- Our global `ValidationPipe` (`transform: true` in `main.ts`) sees `page: number` and simply does `+"abc"`, which gives **`NaN`**.
- `DefaultValuePipe` treats `NaN` as "missing" and puts in **1**. `ParseIntPipe` then gets 1 and is happy.
- So garbage input silently becomes page 1. *Error nahi aaya, chupchaap galat value.*
- I checked this in `node_modules/@nestjs/common/pipes/validation.pipe.js` (`transformPrimitive`) and `default-value.pipe.js`.
- ✅ For real list endpoints, use a **query DTO** (section 15). It rejects `page=abc` with a clear 400.
</details>

## 12. `@Req()` and `@Res()`: the raw Express objects

```ts
@Get('req')
raw(@Req() req: Request) { return { method: req.method, url: req.originalUrl }; }

@Get('res-trap')
resTrap(@Res() res: Response) { return { msg: 'will this be sent?' }; }

@Get('res-passthrough')
passthrough(@Res({ passthrough: true }) res: Response) {
  res.setHeader('X-Powered-By-Me', 'yes');
  return { msg: 'Nest still sends my return value' };
}
```
**Predict:** what does `GET /debug/res-trap` return?

<details><summary>👀 Real output + why</summary>

```
GET /debug/req?x=1          → 200 {"method":"GET","url":"/debug/req?x=1"}
GET /debug/res-trap         → ⏳ no response (gave up after 1 s)
GET /debug/res-passthrough  → 200 {"msg":"Nest still sends my return value"}  [x-powered-by-me: yes]
```
- The moment you inject `@Res()`, Nest says "OK, **you** send the response" and **ignores your return value**.
  Nobody calls `res.json()`, so the request **hangs**. 😱
- ✅ `@Res({ passthrough: true })` lets you set headers or cookies **and** Nest still sends your return value.
- **Why avoid `@Res()`:** things that change the return value (interceptors, `ClassSerializerInterceptor`) can't
  touch the response, and your code gets tied to Express. You'll use passthrough on Day 22 to set a cookie.
</details>

---

# Family 5 · 📋 DTO decorators (Kaise check?)

## 13. What is a DTO, and how does validation run?

**DTO = Data Transfer Object**: a **class** that describes the shape of the data coming in.

🧠 **Memory hook:** two helpers at the gate:
- 🧵 **class-transformer = the darzi (tailor).** It **changes the shape**: JSON → a real class object, `"2"` → `2`, trims spaces.
- 👮 **class-validator = the guard with a checklist.** It **checks the rules**: "is it an email? at least 8 chars?"

What the global `ValidationPipe` does with `@Body() dto: CreateUserDto`:
```
JSON body ──▶ 1. plainToInstance (darzi: @Type, @Transform) ──▶ 2. validate (guard: @IsEmail…) ──┬─▶ errors?  400 with ALL messages
                                                                                                └─▶ OK?      the handler gets a real CreateUserDto
```
⚠️ **A DTO must be a class, not an interface.** An interface vanishes at runtime, so the metatype becomes `Object`, and
ValidationPipe **skips validation completely**. It's silent, with no error, and that's dangerous.
(See `toValidate()` in `validation.pipe.js`: `Object` is in its skip list.)

## 14. The decorators you'll use most

**class-validator** (rules 👮):

| Decorator                                             | Checks                                    |
|-------------------------------------------------------|-------------------------------------------|
| `@IsString()` `@IsInt()` `@IsNumber()` `@IsBoolean()` | type                                      |
| `@IsEmail()` `@IsUUID()` `@IsUrl()` `@IsDateString()` | format                                    |
| `@MinLength(n)` `@MaxLength(n)` `@Length(min, max)`   | string length                             |
| `@Min(n)` `@Max(n)` `@IsPositive()`                   | number range                              |
| `@IsEnum(E)` `@IsIn([...])`                           | only allowed values                       |
| `@Matches(/regex/, { message })`                      | custom pattern + custom message           |
| `@IsNotEmpty()`                                       | not `''`, `null` or `undefined`           |
| `@IsOptional()`                                       | missing? then **skip** all other rules    |
| `@IsArray()` `@ArrayMinSize(n)`                       | arrays                                    |
| `@ValidateNested()` + `@Type(() => X)`                | validate a nested object (needs **both**) |

**class-transformer** (shape 🧵):

| Decorator                      | Does                                               |
|--------------------------------|----------------------------------------------------|
| `@Type(() => X)`               | convert to class X, or to `Number` (query strings) |
| `@Transform(({ value }) => …)` | custom change (trim, lowercase…)                   |
| `@Exclude()`                   | **hide** the field when sending a response         |
| `@Expose()`                    | **show** it (useful on getters)                    |

### Example: `@Body()` with a DTO

```ts
class AddressDto {
  @IsString() @IsNotEmpty() city: string;
  @Matches(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' }) pincode: string;
}

class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() @MaxLength(30) name?: string;
  @IsOptional() @IsEnum(Language) language?: Language;        // enum Language { English = 'en', Hindi = 'hi' }
  @ValidateNested() @Type(() => AddressDto) address: AddressDto;
}

@Post('users')
create(@Body() dto: CreateUserDto) { return { isDtoInstance: dto instanceof CreateUserDto, dto }; }
```

**① Good body** `{ email: '  Prakhar@Mail.COM ', password: 'supersecret', address: {...} }`:
```
→ 201 {"isDtoInstance":true,"dto":{"email":"prakhar@mail.com","password":"supersecret","address":{"city":"Lucknow","pincode":"226001"}}}
```
`@Transform` cleaned the email (trimmed and lowercased) **before** `@IsEmail` checked it. The handler got a real class instance.

**② Bad body** `{ email: 'not-an-email', password: 'short', language: 'fr', address: { city: '', pincode: '12' } }`:
```
→ 400 {"message":[
        "email must be an email",
        "password must be longer than or equal to 8 characters",
        "language must be one of the following values: en, hi",
        "address.city should not be empty",
        "address.pincode must be exactly 6 digits"],
      "error":"Bad Request","statusCode":400}
```
It reports **all** errors at once, and nested errors get a path (`address.city`). The custom message works.

**③ Extra field** `{ ...goodBody, isAdmin: true }`:
```
→ 400 {"message":["property isAdmin should not exist"],"error":"Bad Request","statusCode":400}
```
This is `forbidNonWhitelisted` at work. 🛡️ **Security:** it stops **mass assignment**, where a user sneaks in
`isAdmin: true` or `role: 'admin'`. (`whitelist` alone would silently strip the field; `forbidNonWhitelisted` rejects it.)
⚠️ So **never put fields like `role` in a signup DTO.** Admins set roles through a separate, protected route.

## 15. 🤔 Puzzle: query DTOs and `@Type(() => Number)`

```ts
class QueryWithoutType {                 // ❌ no @Type
  @IsOptional() @IsInt() @Min(1) page?: number;
}

class ListProductsQuery {                // ✅
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)          page: number = 1;    // default value
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 20;
  @IsOptional() @IsIn(['price', 'name'])                        sort?: 'price' | 'name';
}
```
**Predict:** `GET /products-no-type?page=2`. Does `page=2` pass `@IsInt()`?

<details><summary>👀 Real output + why</summary>

```
GET /products-no-type?page=2                → 400 {"message":["page must not be less than 1","page must be an integer number"],...}
GET /products                               → 200 {"page":1,"limit":20,"typeofPage":"number"}          ← defaults kick in
GET /products?page=2&limit=5&sort=price     → 200 {"page":2,"limit":5,"sort":"price","typeofPage":"number"}
GET /products?page=abc&limit=500&sort=stock → 400 {"message":["page must not be less than 1","page must be an integer number",
                                                  "limit must not be greater than 100","sort must be one of the following values: price, name"],...}
```
- Query values are **strings**: `"2"` is not an integer. For a whole DTO (`@Query() q: Dto`) Nest does **not**
  auto-convert each field. (The `+value` trick from section 11 only applies to single named params like `@Query('page')`.)
- `@Type(() => Number)` tells the darzi to convert `"2"` → `2` first.
- Compare with section 11: with the DTO, `page=abc` now gives a proper **400**. ✅
- Shortcut you'll see online: `transformOptions: { enableImplicitConversion: true }` converts using the TS types automatically.
  ⚠️ But it does `Boolean("false")`, which is **`true`**. I tested it: `{ inStock: 'false' }` → `{ inStock: true }`. 😬 Explicit `@Type` is safer.
</details>

## 16. 🤔 Puzzle: hiding the password with `@Exclude()`

```ts
class UserEntity {
  id: number;
  email: string;
  @Exclude() passwordHash: string;                                   // hide
  @Expose() get displayName() { return this.email.split('@')[0]; }   // add a computed field
  constructor(data: Partial<UserEntity>) { Object.assign(this, data); }
}

@Get('users/1')
@UseInterceptors(ClassSerializerInterceptor)
findOne() { return new UserEntity(fakeUser); }          // a class instance

@Get('users/1/plain')
@UseInterceptors(ClassSerializerInterceptor)
findOnePlain() { return { ...fakeUser }; }              // a plain object
```
**Predict:** does `/users/1/plain` hide the password?

<details><summary>👀 Real output + why</summary>

```
GET /users/1        → 200 {"id":1,"email":"prakhar@mail.com","displayName":"prakhar"}
GET /users/1/plain  → 200 {"id":1,"email":"prakhar@mail.com","passwordHash":"$argon2id$secret"}   😱 LEAKED
```
- `ClassSerializerInterceptor` reads the decorators from the **class**. A plain object has no class,
  so it has no `@Exclude`, and **everything** goes out.
- Prisma returns **plain objects**! So `return this.prisma.user.findUnique(...)` would leak the hash too.
- ✅ **Defence in depth:** (1) only **select** the fields you need from the DB, *and* (2) wrap the result in an entity class.
</details>

💡 Coming on Day 9: `PartialType(CreateUserDto)` builds an `UpdateUserDto` with every field optional and the same rules.
It's a helper function, not a decorator, from `@nestjs/mapped-types` (not installed yet).

---

# Family 6 · 🛡️ Enhancers: things that run around your handler

## 17. The four `@Use…` decorators

| Decorator             | Job                                                | 🧠 Hook            |
|-----------------------|----------------------------------------------------|--------------------|
| `@UseGuards(G)`       | **yes/no**: may this request enter? (auth, roles)  | 🚪 bouncer         |
| `@UseInterceptors(I)` | work **before + after** the handler (wrap, timing) | 🎁 gift-wrapper    |
| `@UsePipes(P)`        | **convert/validate** the input                     | 🧹 chhanni (sieve) |
| `@UseFilters(F)`      | turn an **error** into a response                  | 🚑 ambulance       |
| `@Catch(E)`           | goes on a filter: **which** errors it handles      |                    |

**3 levels.** The same enhancer can be bound at different levels:

| Level      | How                                  | Covers                                    |
|------------|--------------------------------------|-------------------------------------------|
| Method     | `@UseGuards(G)` above a method       | that one route                            |
| Controller | `@UseGuards(G)` above the class      | every route in the class                  |
| Global     | `app.useGlobalGuards()` in `main.ts` | the whole app (like our `ValidationPipe`) |

The full order (middleware → guards → interceptors → pipes → handler → …) comes on **Day 10**.

## 18. Demo: guards + interceptors on a controller

```ts
@Controller('shop')
@UseGuards(AuthGuard)               // every route in this class is protected…
@UseInterceptors(WrapInterceptor)   // …and every response gets wrapped
class ShopController {
  @Public()                         // …except this one (custom decorator, section 21)
  @Get('products') products() { return ['pen', 'book']; }

  @Get('me') me(@CurrentUser() user: User) { return user; }
}
```
The fake login is the header `x-user: "name:role"` (real JWT comes on Day 22).
```
GET /shop/products              → 200 {"data":["pen","book"],"wrappedBy":"WrapInterceptor"}     ← @Public, no login needed
GET /shop/me     (no header)    → 401 {"message":"login first","error":"Unauthorized","statusCode":401}
GET /shop/me     (bob:customer) → 200 {"data":{"name":"bob","role":"customer"},"wrappedBy":"WrapInterceptor"}
```
The interceptor wrapped every successful response in `{ data, wrappedBy }`. That's the **"after"** part of an interceptor:
```ts
intercept(_ctx, next) {
  return next.handle().pipe(map((data) => ({ data, wrappedBy: 'WrapInterceptor' })));
}
```

## 19. 🤔 Puzzle: errors. Which status does each give?

```ts
@Post('orders')     @UseFilters(OutOfStockFilter)  order()   { throw new OutOfStockError('only 0 pens left'); }
@Get('products/99')                                missing() { throw new NotFoundException('product 99 not found'); }
@Get('crash')                                      crash()   { throw new Error('db password is hunter2'); }

@Catch(OutOfStockError)      // this filter handles ONLY OutOfStockError
class OutOfStockFilter implements ExceptionFilter {
  catch(err: OutOfStockError, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(409).json({ error: 'OUT_OF_STOCK', message: err.message });
  }
}
```

<details><summary>👀 Real output + why</summary>

```
POST /shop/orders       → 409 {"error":"OUT_OF_STOCK","message":"only 0 pens left"}                    ← our filter
GET  /shop/products/99  → 404 {"message":"product 99 not found","error":"Not Found","statusCode":404}  ← built-in
GET  /shop/crash        → 500 {"statusCode":500,"message":"Internal server error"}                     ← message HIDDEN 🛡️
```
- **`HttpException` family** → Nest knows the status: `BadRequestException` 400, `UnauthorizedException` 401,
  `ForbiddenException` 403, `NotFoundException` 404, `ConflictException` 409.
- **A plain `Error`** → Nest doesn't know what it is, so it sends a **500 and hides your message**.
  Good! The "db password" never reaches the client. (Log it on the server instead, Day 26.)
- The error responses are **not** wrapped by the interceptor: `map()` runs only on success.
</details>

## 20. 401 vs 403 🔑

```
DELETE /shop/products/1  (bob:customer) → 403 {"message":"Forbidden resource","error":"Forbidden","statusCode":403}
DELETE /shop/products/1  (alice:admin)  → 200 {"data":{"deleted":1},"wrappedBy":"WrapInterceptor"}
```
| Status               | Meaning                           | The guard does                      |
|----------------------|-----------------------------------|-------------------------------------|
| **401** Unauthorized | "**Who are you?**" Not logged in  | `throw new UnauthorizedException()` |
| **403** Forbidden    | "I know you, but **not allowed**" | `return false` (Nest sends 403)     |

---

# Family 7 · ✍️ Make your own decorators

## 21. The 4 tools

| Tool                             | Makes                              | Demo                |
|----------------------------------|------------------------------------|---------------------|
| `SetMetadata(key, value)`        | metadata sticker (classic way)     | `@Public()`         |
| `Reflector.createDecorator<T>()` | **typed** metadata sticker (newer) | `@Roles(['admin'])` |
| `createParamDecorator(fn)`       | a **param** decorator              | `@CurrentUser()`    |
| `applyDecorators(...)`           | **many** decorators in one         | `@Auth('admin')`    |

🧠 **Key idea:** metadata decorators only **write** a note. Some other code (usually a guard) must **read** it
with `Reflector`. *Sticker lagao, guard padhega.* **Without the guard, `@Roles('admin')` does NOTHING.** ⚠️

```ts
// 1. Sticker the classic way
const IS_PUBLIC = 'isPublic';
const Public = () => SetMetadata(IS_PUBLIC, true);

// 2. Typed sticker
const Roles = Reflector.createDecorator<string[]>();

// …and the guard READS both:
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
const roles    = this.reflector.get(Roles, ctx.getHandler());
```
`getAllAndOverride` checks the **method** first, then the **class**. The method's sticker wins.
That's how `@Public()` on one method beats `@UseGuards(AuthGuard)` on the whole class.

```ts
// 3. Param decorator: pull the logged-in user out of the request (the guard put it there)
const CurrentUser = createParamDecorator((field: keyof User | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  return field ? user?.[field] : user;
});

@Get('me')      me(@CurrentUser() user: User) { return user; }
@Get('my-name') myName(@CurrentUser('name') name: string) { return { name }; }
```
```
GET /shop/my-name (bob:customer) → 200 {"data":{"name":"bob"},"wrappedBy":"WrapInterceptor"}
```
Much cleaner than `@Req() req` + `req.user.name` in every handler.

```ts
// 4. Combo sticker
function Auth(...roles: string[]) {
  return applyDecorators(UseGuards(AuthGuard), Roles(roles));
}

@Auth('admin')            // = @UseGuards(AuthGuard) + @Roles(['admin'])
@Get('stats') stats() { return { orders: 42 }; }
```
```
GET /admin/stats (bob:customer) → 403 {"message":"Forbidden resource","error":"Forbidden","statusCode":403}
GET /admin/stats (alice:admin)  → 200 {"orders":42}
```
This is exactly what we'll build for real on **Day 22–23** (JWT guard + `@Roles` + `@CurrentUser`).

---

# 🔮 Coming later this month (preview)

Most of these packages **aren't installed yet**. The syntax is shown so the names look familiar;
we'll check it against the real version on that day.

| Day | For                        | Package                                       |
|-----|----------------------------|-----------------------------------------------|
| 13  | auto-generated API docs    | `@nestjs/swagger`                             |
| 13  | API versioning (`/v2/...`) | `@nestjs/common`                              |
| 23  | rate limiting (e.g. login) | `@nestjs/throttler`                           |
| 24  | scheduled jobs             | `@nestjs/schedule`                            |
| 24  | background job queues      | `@nestjs/bullmq`                              |
| 25  | file upload                | `@nestjs/common` + `@nestjs/platform-express` |

The decorators, by package:
- **swagger:** `@ApiTags('products')`, `@ApiProperty()`, `@ApiOperation({ summary })`,
  `@ApiResponse({ status, description })`, `@ApiBearerAuth()`
- **versioning:** `@Version('2')`
- **throttler:** `@Throttle(...)`, `@SkipThrottle()`
- **schedule:** `@Cron('0 * * * *')`, `@Interval(ms)`, `@Timeout(ms)`
- **bullmq:** `@Processor('emails')`, `@InjectQueue('emails')`
- **file upload:** `@UploadedFile()` + `@UseInterceptors(FileInterceptor('file'))`

---

## 🎤 Interview answers (say them out loud, in your own words)

**Q: What does `@Injectable()` do? Is it required?**
> It marks a class as a provider that Nest's DI container can create. More importantly, because the class has a
> decorator, TypeScript emits its constructor parameter types as metadata, and that's what Nest reads to inject
> dependencies. A class with no dependencies works without it. But if it has dependencies and you forget it, Nest
> injects nothing: they're `undefined`, and it crashes at runtime, not at startup. So I always add it.

**Q: `@Param` vs `@Query` vs `@Body`?**
> `@Param` reads path segments, like the 42 in `/products/42`, which usually identify a resource. `@Query` reads the
> query string after the `?`, for filtering, sorting and pagination. `@Body` reads the parsed request body, the data
> to create or update. Everything in the URL arrives as a string, so I convert it with pipes like `ParseIntPipe`,
> or with a DTO using `@Type(() => Number)`.

**Q: How does validation work in Nest?**
> I describe the input as a DTO class with class-validator decorators. A global `ValidationPipe` uses
> class-transformer to turn the JSON into an instance of that class, validates it, and returns 400 with all the
> messages if anything fails. With `whitelist` and `forbidNonWhitelisted`, unknown fields are rejected, which protects
> against mass assignment. The DTO must be a class, not an interface, because interfaces don't exist at runtime.

**Q: How do you hide the password in API responses?**
> I put `@Exclude()` on the field and return a class instance through `ClassSerializerInterceptor`. But it only works on
> class instances. A plain object, like what Prisma returns, would leak everything. So I also select only the
> columns I need from the database.

**Q: How would you build role-based access with decorators?**
> A `@Roles('admin')` decorator only stores metadata on the route. A guard reads it with `Reflector`, compares it with
> the user's role from the request, and returns false, which Nest turns into 403. I combine `UseGuards` and `Roles`
> into one `@Auth()` decorator with `applyDecorators`, and add a `@Public()` decorator so specific routes can skip a
> controller-level guard.

**Q: Why avoid `@Res()`?**
> When you inject `@Res()`, Nest stops handling the response and ignores the return value. If you forget `res.json()`,
> the request hangs. Interceptors and serialization can't change the response anymore, and the code is tied to
> Express. If I only need to set a header or cookie, I use `@Res({ passthrough: true })`.

## ⚠️ Interview traps

| They say…                                 | You say…                                                       |
|-------------------------------------------|----------------------------------------------------------------|
| "`@Injectable()` is just decoration."     | No metadata → deps `undefined` → crash at **runtime**          |
| "`@Param('id') id: number` is a number."  | It's a **string**. `ParseIntPipe` converts it, rejects `'abc'` |
| "Route order doesn't matter."             | Top to bottom! Put `search` **above** `:id`                    |
| "POST returns 200."                       | POST → **201** (change it with `@HttpCode`). 204 = no body     |
| "Use an interface for the DTO."           | Interfaces vanish → validation **skipped**, silently           |
| "`@IsInt()` works for `?page=2`."         | `"2"` is a string → add `@Type(() => Number)`                  |
| "`@ValidateNested()` is enough."          | Add `@Type(() => X)` too, or valid fields get rejected         |
| "`enableImplicitConversion` is the fix."  | It turns `"false"` into `true`. Prefer `@Type`                 |
| "`@Exclude()` hides the password always." | Only on **class instances**. Prisma's plain objects leak       |
| "Send the response with `@Res()`."        | Return value ignored → request **hangs**. Use `passthrough`    |
| "`@Roles('admin')` protects the route."   | Only a sticker. A **guard** must read it (`Reflector`)         |
| "A guard returning `false` gives 401."    | `false` → **403**. For 401, throw `UnauthorizedException`      |
| "`throw new Error()` shows my message."   | **500**, message hidden. Use `NotFoundException` etc.          |
| "`ParseIntPipe` rejects `?page=abc`."     | Not after `DefaultValuePipe` here: `NaN` → page 1. Use a DTO   |

## 🔁 Quick self-check (answer before opening)

<details><summary>1. You forgot <code>@Injectable()</code> on a service that has a constructor dependency. When do you find out?</summary>

At **runtime**, when a request uses the missing dependency (`Cannot read properties of undefined`). Startup works fine.
</details>

<details><summary>2. <code>@Controller('orders')</code> + <code>@Get(':id/items')</code>. What's the full URL?</summary>

`GET /orders/:id/items`, e.g. `/orders/5/items`.
</details>

<details><summary>3. Why <code>@Type(() => AddressDto)</code> next to <code>@ValidateNested()</code>?</summary>

The nested JSON is a plain object. `@Type` turns it into an `AddressDto` instance, so its rules are attached and can be checked.
Without it (I tested this), the nested object has **no** rules, so our `whitelist` setting treats every field as unknown.
Even a **valid** address gets rejected, with a confusing message:
```
body { address: { city: 'Lucknow' } }  → 400 {"message":["address.property city should not exist"],...}
```
If you see `property X should not exist` for a field that **is** in your DTO, check for a missing `@Type`.

</details>

<details><summary>4. A guard returns <code>false</code>. Which status does the client get?</summary>

**403 Forbidden** ("Forbidden resource").
</details>

<details><summary>5. Name the 4 tools for making your own decorators.</summary>

`SetMetadata`, `Reflector.createDecorator`, `createParamDecorator`, `applyDecorators`.
</details>
