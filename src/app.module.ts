import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { TimingInterceptor } from './common/interceptors/timing.interceptor.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global filter and interceptor, registered as PROVIDERS (the APP_* tokens) instead of
    // app.useGlobalFilters() / app.useGlobalInterceptors() in main.ts. Being inside the module means:
    // - the e2e tests get them too (createNestApplication() never runs main.ts);
    // - Nest creates them with DI, so they could inject other services if they needed to.
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
  ],
})
// `implements NestModule` + configure() is how a module attaches middleware.
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Run RequestIdMiddleware for every route ('*' = all paths; checked on Nest 12 + Express 5).
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
