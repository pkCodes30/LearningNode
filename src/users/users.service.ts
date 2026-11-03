import { Injectable, NotFoundException } from '@nestjs/common';
// `import type`: `User` is only a TypeScript type (the shape of a row), so nothing is needed at runtime.
import type { User } from '../generated/prisma/client.js';
// A normal import (not `import type`): Nest needs the real PrismaService class at runtime to know
// what to inject into the constructor below.
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

/**
 * All the business logic for users.
 *
 * It knows nothing about HTTP: no `req`, no `res`, no status codes. It talks to the database and
 * throws Nest exceptions (like NotFoundException) when something is wrong. That keeps it reusable:
 * a controller, a cron job or a queue worker could all call it.
 *
 * Two DB errors are NOT handled here, on purpose:
 * - a duplicate email          → Prisma error code P2002 → 409 Conflict
 * - update/delete a missing id → Prisma error code P2025 → 404 Not Found
 * The global PrismaExceptionFilter (src/common/filters/prisma-exception.filter.ts) turns them into
 * those responses for every service in the app, so we don't need a try/catch in each method.
 */
@Injectable()
export class UsersService {
  // Dependency injection: Nest sees the type `PrismaService` and passes in the ONE shared instance
  // (providers are singletons). We never write `new PrismaService()` ourselves.
  // `private readonly` saves it as `this.prisma` in one step (a TypeScript "parameter property").
  constructor(private readonly prisma: PrismaService) {}

  /** POST /users: save a new user and return the saved row (with its new `id`). */
  create(dto: CreateUserDto): Promise<User> {
    // We RETURN the promise. Nest awaits it for us, and the query really runs then.
    // (A Prisma query that nobody awaits never runs at all; see notes/08 §8.)
    // There's no try/catch here, so a plain `return` is enough: if the query fails, the rejection
    // travels up to Nest, and the filter answers. Inside a try/catch you'd need `return await`
    // (notes/08 §6), otherwise the error escapes the catch.
    // `dto` holds only the allowed fields (email, name), so it's safe to pass as `data`.
    return this.prisma.user.create({ data: dto });
  }

  /** GET /users: every user, oldest first. */
  findAll(): Promise<User[]> {
    // `orderBy` gives a stable order. Without ORDER BY, SQL doesn't promise any order at all.
    return this.prisma.user.findMany({ orderBy: { id: 'asc' } });
  }

  /** GET /users/:id: one user, or a 404. */
  async findOne(id: number): Promise<User> {
    // `findUnique` returns `null` when nothing matches. It does NOT throw, so the filter can't help:
    // we must check ourselves. That's why this method needs `async` + `await`: we look at the
    // result before deciding what to do.
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      // Nest turns this into: 404 {"message":"User 5 not found","error":"Not Found","statusCode":404}
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  /** PATCH /users/:id: change only the fields that were sent, return the updated user. */
  update(id: number, dto: UpdateUserDto): Promise<User> {
    // UpdateUserDto has every field optional, so `dto` holds only what the client sent,
    // and Prisma updates only those columns.
    // Missing id → P2025 → 404 (filter). Email already used by someone else → P2002 → 409 (filter).
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  /** DELETE /users/:id: delete the user. The controller answers 204 with an empty body. */
  async remove(id: number): Promise<void> {
    // We `await` so the method finishes only after the row is really gone, and so it returns
    // nothing (void) instead of the deleted row. Missing id → P2025 → 404 (filter).
    await this.prisma.user.delete({ where: { id } });
  }
}
