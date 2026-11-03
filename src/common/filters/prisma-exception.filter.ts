import {
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
// `Prisma` is a namespace object from our generated client. It holds Prisma's error classes.
// A normal import (not `import type`), because @Catch() below needs the real class at runtime.
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Turns known Prisma errors into proper HTTP responses, for the WHOLE app.
 *
 * Without this, a duplicate email would reach Nest as an unknown error → 500 Internal Server Error,
 * even though the client did something normal. With it, every service can just call Prisma and let
 * this one place decide the status code. It's registered globally in AppModule as APP_FILTER.
 *
 * Where it sits in the request lifecycle (notes/09): a filter runs only when something THROWS,
 * anywhere after the middleware (guard, pipe, handler, interceptor). It writes the error response.
 */
// @Catch(X) = "only call this filter for errors that are `instanceof X`". Every other error
// (like a NotFoundException from a service) still goes to Nest's built-in filter as before.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  // Nest's built-in logger. The name in brackets shows up in each log line: [PrismaExceptionFilter]
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    // `host` wraps the current request. For HTTP, switchToHttp().getResponse() gives Express's `res`.
    const response = host.switchToHttp().getResponse<Response>();

    // Pick the right Nest exception for this Prisma error code (see the table in notes/08 §5).
    const httpError = this.toHttpException(exception);

    // Send it the same way Nest's built-in filter would:
    //   status: 409 / 404 / 500
    //   body:   {"message":"…","error":"Conflict","statusCode":409}
    response.status(httpError.getStatus()).json(httpError.getResponse());
  }

  private toHttpException(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException {
    switch (exception.code) {
      // P2002 = "Unique constraint failed": a row with this value already exists (here: the email).
      case 'P2002':
        return new ConflictException('A record with this value already exists');

      // P2025 = "Record to update/delete not found": update() or delete() with an id that doesn't exist.
      case 'P2025':
        return new NotFoundException('Record not found');

      // Any other Prisma error is OUR problem (a bug or a DB issue), not the client's.
      // Log the full details for us, but send only a generic 500 to the client:
      // never leak table names, SQL or stack traces in an API response.
      default:
        this.logger.error(
          `Unhandled Prisma error ${exception.code}`,
          exception.stack,
        );
        return new InternalServerErrorException();
    }
  }
}
