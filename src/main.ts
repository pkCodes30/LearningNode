import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  // Creating the app runs ConfigModule's `validate` first. A bad .env stops us right here.
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  // Read PORT from the VALIDATED config instead of `process.env.PORT`: it's already checked
  // (1–65535) and converted to a number. `ConfigService<EnvironmentVariables, true>` +
  // `{ infer: true }` lets TypeScript know `get('PORT')` returns a number, and catches typos in the key.
  const config: ConfigService<EnvironmentVariables, true> =
    app.get(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
