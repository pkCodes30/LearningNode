// Day 10 · The request lifecycle: who runs first? Every piece logs when it runs.
// PREDICT the log lines (and the status) for each of the 4 requests. Then run:
//   npx tsc -p playground/day10 && node playground/day10/dist/01-lifecycle.js

import 'reflect-metadata';
import {
  BadRequestException,
  Catch,
  Controller,
  Get,
  HttpException,
  Injectable,
  Module,
  Param,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
  type ArgumentsHost,
  type CallHandler,
  type CanActivate,
  type ExceptionFilter,
  type ExecutionContext,
  type MiddlewareConsumer,
  type NestInterceptor,
  type NestMiddleware,
  type NestModule,
  type PipeTransform,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type Observable, tap } from 'rxjs';
import type { NextFunction, Request, Response } from 'express';

const log = (msg: string) => console.log(`   ${msg}`);

@Injectable()
class LogMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    log('1. middleware');
    next();
  }
}

@Injectable()
class DemoGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const deny = ctx.switchToHttp().getRequest<Request>().query.deny === '1';
    log(`2. guard → ${deny ? 'DENY' : 'allow'}`);
    return !deny;
  }
}

@Injectable()
class DemoInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    log('3. interceptor (before)');
    return next.handle().pipe(tap(() => log('6. interceptor (after)')));
  }
}

class DemoPipe implements PipeTransform<string, number> {
  transform(value: string) {
    log(`4. pipe ('${value}')`);
    const id = Number(value);
    if (Number.isNaN(id)) throw new BadRequestException('id must be a number');
    return id;
  }
}

@Catch()
class DemoFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    log(`7. exception filter (${status})`);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: (exception as Error).message });
  }
}

@Controller('demo')
@UseGuards(DemoGuard)
@UseInterceptors(DemoInterceptor)
@UseFilters(DemoFilter)
class DemoController {
  @Get(':id')
  find(@Param('id', DemoPipe) id: number, @Query('fail') fail?: string) {
    log(`5. handler (id = ${id})`);
    if (fail === '1') throw new Error('handler blew up');
    return { id };
  }
}

@Module({ controllers: [DemoController] })
class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LogMiddleware).forRoutes(DemoController);
  }
}

const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(0);
const base = `http://localhost:${app.getHttpServer().address().port}`;

for (const path of ['/demo/5', '/demo/5?deny=1', '/demo/abc', '/demo/5?fail=1']) {
  console.log(`GET ${path}`);
  const res = await fetch(base + path);
  console.log(`   → ${res.status} ${await res.text()}`);
}
await app.close();
