import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Gives every request an ID and sends it back in the `x-request-id` response header.
 *
 * Why: when a user reports "my request failed", they (or the frontend, or another service) can
 * tell us the ID, and we can find exactly that request in the logs (Day 26: correlation IDs).
 *
 * Why MIDDLEWARE: it runs first, for every request, before Nest even picks a route (notes/09).
 * So even requests that fail in a guard, a pipe or a filter still get an ID.
 * It's applied to all routes in AppModule.configure().
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // If the caller already has an ID (for example a gateway or another service in front of us),
    // keep it, so the same ID follows the request across services. `req.header()` reads a request
    // header (case-insensitive) and returns undefined when it's missing.
    const incomingId = req.header('x-request-id');

    // Trust the incoming ID only if it's short. Otherwise anyone could send a 1 MB header and we'd
    // copy it into every log line and response. No usable ID? Make a new random one (a UUID).
    const requestId =
      incomingId && incomingId.length <= 100 ? incomingId : randomUUID();

    // Set the response header now, so it's there however the request ends (success or error).
    res.setHeader('x-request-id', requestId);

    // Middleware MUST call next(), or the request stops here and the client waits forever.
    next();
  }
}
