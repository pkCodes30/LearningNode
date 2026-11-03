import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';

/**
 * Adds an `X-Response-Time` header (like `12ms`) to every successful response.
 *
 * Why an INTERCEPTOR: it's the only piece that runs both BEFORE and AFTER the handler (the onion,
 * notes/09), so it can start a stopwatch on the way in and stop it on the way out.
 * Registered globally in AppModule as APP_INTERCEPTOR.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // ── On the way IN (before the pipes and the handler run) ──
    // performance.now() = a precise clock in milliseconds, good for measuring durations.
    const startedAt = performance.now();

    // next.handle() runs the rest of the chain (pipes → handler) and gives back an RxJS
    // Observable: a stream that will carry the handler's result when it's ready.
    return next.handle().pipe(
      // ── On the way OUT ──
      // tap() lets us run code when the result passes through, without changing the result.
      // It runs only on SUCCESS: if the handler throws, the error skips tap() and goes to a filter,
      // so error responses don't get this header (we saw that in the Day 10 puzzle).
      tap(() => {
        const elapsedMs = Math.round(performance.now() - startedAt);
        // The response hasn't been sent yet (Nest sends it after the interceptors finish),
        // so we can still add a header here.
        const response = context.switchToHttp().getResponse<Response>();
        response.setHeader('X-Response-Time', `${elapsedMs}ms`);
      }),
    );
  }
}
