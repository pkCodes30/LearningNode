// Day 11 · Build your own dynamic module: MailerModule.forRoot(options) and forRootAsync(...).
// PREDICT the 2 lines, then run:
//   npx tsc -p playground/day11 && node playground/day11/dist/02-dynamic-module.js

import 'reflect-metadata';
import { Inject, Injectable, Module, type DynamicModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

interface MailerOptions {
  from: string;
  fake: boolean;
}

// A Symbol token for the options: unique, so it can't clash with anyone else's 'OPTIONS' string.
const MAILER_OPTIONS = Symbol('MAILER_OPTIONS');

// The service the module offers. It doesn't know WHERE its options came from; it just injects them.
@Injectable()
class MailerService {
  constructor(@Inject(MAILER_OPTIONS) private readonly options: MailerOptions) {}

  send(to: string) {
    return `${this.options.fake ? 'FAKE' : 'REAL'} mail from ${this.options.from} to ${to}`;
  }
}

@Module({})
class MailerModule {
  // forRoot: the caller already knows the options (plain values) → useValue.
  static forRoot(options: MailerOptions): DynamicModule {
    return {
      module: MailerModule,
      providers: [{ provide: MAILER_OPTIONS, useValue: options }, MailerService],
      exports: [MailerService],
    };
  }

  // forRootAsync: the options must be BUILT from other providers (like ConfigService) → useFactory.
  static forRootAsync(config: {
    imports?: DynamicModule['imports'];
    inject?: any[];
    useFactory: (...args: any[]) => MailerOptions | Promise<MailerOptions>;
  }): DynamicModule {
    return {
      module: MailerModule,
      imports: config.imports ?? [], // modules the factory's dependencies come from
      providers: [
        { provide: MAILER_OPTIONS, useFactory: config.useFactory, inject: config.inject ?? [] },
        MailerService,
      ],
      exports: [MailerService],
    };
  }
}

// A stand-in for ConfigService: where the real settings come from.
@Injectable()
class EnvService {
  private readonly env: Record<string, string> = { MAIL_FROM: 'orders@shoplite.dev', MAIL_FAKE: 'false' };
  get(key: string) {
    return this.env[key];
  }
}
@Module({ providers: [EnvService], exports: [EnvService] })
class EnvModule {}

// App 1: options written right here.
@Module({ imports: [MailerModule.forRoot({ from: 'dev@localhost', fake: true })] })
class DevAppModule {}

// App 2: options built at startup from EnvService.
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: async (env: EnvService) => ({
        from: env.get('MAIL_FROM'),
        fake: env.get('MAIL_FAKE') === 'true',
      }),
    }),
  ],
})
class ProdAppModule {}

for (const [label, rootModule] of [
  ['forRoot     ', DevAppModule],
  ['forRootAsync', ProdAppModule],
] as const) {
  const app = await NestFactory.createApplicationContext(rootModule, { logger: false });
  console.log(`${label} → ${app.get(MailerService).send('asha@shop.dev')}`);
  await app.close();
}
