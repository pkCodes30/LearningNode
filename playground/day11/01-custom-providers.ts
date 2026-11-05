// Day 11 · The 4 ways to register a provider: useClass, useValue, useFactory, useExisting.
// PREDICT the 6 lines. Then run it twice and compare line 1:
//   npx tsc -p playground/day11 && node playground/day11/dist/01-custom-providers.js
//   NODE_ENV=production node playground/day11/dist/01-custom-providers.js

import 'reflect-metadata';
import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

// An abstract class used as a TOKEN (a name tag Nest looks things up by), plus two implementations.
// An abstract class works as a token because it still exists at runtime (an interface would not).
abstract class Mailer {
  abstract send(to: string): string;
}

@Injectable()
class SmtpMailer extends Mailer {
  send(to: string) {
    return `SMTP → really sent to ${to}`;
  }
}

@Injectable()
class FakeMailer extends Mailer {
  send(to: string) {
    return `FAKE → pretended to send to ${to}`;
  }
}

let factoryRuns = 0; // counts how many times the factory below runs

@Injectable()
class SignupService {
  constructor(
    readonly mailer: Mailer, // token = the Mailer class itself (Nest reads it from the type)
    @Inject('APP_NAME') readonly appName: string, // token = a string, so @Inject() is needed
    @Inject('DB_CONFIG') readonly db: { url: string; poolSize: number },
    @Inject('EMAIL_SENDER') readonly alias: Mailer,
  ) {}
}

const useFake = process.env.NODE_ENV !== 'production';

@Module({
  providers: [
    SignupService, // shorthand for { provide: SignupService, useClass: SignupService }

    // useClass: "when someone asks for Mailer, create THIS class". Swap implementations by env.
    { provide: Mailer, useClass: useFake ? FakeMailer : SmtpMailer },

    // useValue: "give them THIS ready-made value". Constants, config objects, test fakes.
    { provide: 'APP_NAME', useValue: 'ShopLite' },

    // useFactory: "run THIS function to build the value". It can be async and can use other
    // providers, listed in `inject` (they arrive as the function's arguments, in order).
    {
      provide: 'DB_CONFIG',
      useFactory: async (appName: string) => {
        factoryRuns++;
        await new Promise((resolve) => setTimeout(resolve, 50)); // pretend: fetch a secret
        return { url: `postgres://localhost/${appName.toLowerCase()}`, poolSize: 10 };
      },
      inject: ['APP_NAME'],
    },

    // useExisting: "this token is just another NAME for that provider" (an alias).
    { provide: 'EMAIL_SENDER', useExisting: Mailer },
  ],
})
class AppModule {}

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const signup = app.get(SignupService);
console.log('1. mailer           :', signup.mailer.send('asha@shop.dev'));
console.log('2. app name         :', signup.appName);
console.log('3. db config        :', signup.db);
console.log('4. alias === mailer :', signup.alias === signup.mailer);
console.log('5. factory ran      :', factoryRuns, 'time(s)');
console.log('6. same service?    :', app.get(SignupService) === signup);
await app.close();
