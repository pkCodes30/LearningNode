import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The shape of the JSON body for `POST /users`.
 *
 * The global ValidationPipe (src/main.ts) checks these decorators BEFORE the controller runs:
 * - a rule fails                → 400 Bad Request with a list of messages, and our code never runs;
 * - a field is NOT listed here  → 400 too ("property role should not exist"), because main.ts sets
 *   `forbidNonWhitelisted`. That's how we block mass assignment (a client sneaking in `role: "admin"`).
 *
 * It must be a CLASS, not a TypeScript interface: interfaces disappear when TS compiles to JS,
 * but the pipe needs something real at runtime to read these decorators from.
 *
 * Only `email` and `name` are here because those are the only columns a client may set in the
 * `User` table (prisma/schema.prisma). `id`, `createdAt` and `updatedAt` are filled in by the DB.
 */
export class CreateUserDto {
  // Required. Must look like an email address, otherwise: "email must be an email".
  @IsEmail()
  email: string;

  // Optional. If `name` is missing (or null), @IsOptional() skips the two rules below it.
  // If it IS sent, it must be a string of at most 100 characters: an API should never
  // accept unlimited input, even when the DB column could store it.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
