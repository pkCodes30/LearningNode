// Nest decorators · Demo 1: @Injectable, @Inject, @Optional (and what happens if you FORGET @Injectable).
// PREDICT the last two lines first, then run:
//   npx tsc -p playground/nest-decorators && node playground/nest-decorators/dist/01-injectable.js
import { Inject, Injectable, Module, Optional } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Injectable()
class ClockService {
  now() {
    return '10:30';
  }
}

@Injectable()
class GoodService {
  constructor(private readonly clock: ClockService) {}
  hello() {
    return `GoodService: time is ${this.clock.now()}`;
  }
}

// No @Injectable(), and NO constructor dependencies.
class NoDepsService {
  hello() {
    return 'NoDepsService: works fine';
  }
}

// ❌ Forgot @Injectable(), but it HAS a constructor dependency.
class ForgotService {
  constructor(private readonly clock: ClockService) {}
  hello() {
    return `ForgotService: time is ${this.clock.now()}`;
  }
}

// Tokens: a name tag for things that are NOT classes (a string, a config object, an interface).
const APP_NAME = 'APP_NAME';
const STARTED_AT = Symbol('STARTED_AT');

@Injectable()
class TokenService {
  constructor(
    @Inject(APP_NAME) private readonly appName: string,
    @Inject(STARTED_AT) private readonly startedAt: string,
    @Optional() @Inject('MAILER') private readonly mailer?: { send(): void },
  ) {}
  hello() {
    return `TokenService: ${this.appName} started at ${this.startedAt}, mailer = ${this.mailer}`;
  }
}

@Module({
  providers: [
    ClockService,
    GoodService,
    NoDepsService,
    ForgotService,
    TokenService,
    { provide: APP_NAME, useValue: 'ShopLite' },
    { provide: STARTED_AT, useFactory: (clock: ClockService) => clock.now(), inject: [ClockService] },
  ],
})
class DemoModule {}

const ctx = await NestFactory.createApplicationContext(DemoModule, { logger: false });
console.log(ctx.get(GoodService).hello());
console.log(ctx.get(NoDepsService).hello());
console.log(ctx.get(TokenService).hello());
console.log('one shared ClockService?', ctx.get(ClockService) === ctx.get(ClockService));
try {
  console.log(ctx.get(ForgotService).hello());
} catch (err) {
  console.log('ForgotService: 💥', (err as Error).message);
}
await ctx.close();

// Same 'MAILER' token, but WITHOUT @Optional() and nobody provides it.
@Injectable()
class StrictService {
  constructor(@Inject('MAILER') private readonly mailer: { send(): void }) {}
}

@Module({ providers: [StrictService] })
class StrictModule {}

try {
  await NestFactory.createApplicationContext(StrictModule, { logger: false, abortOnError: false });
} catch (err) {
  console.log('StrictService: 💥', (err as Error).message.split('\n')[0]);
}
