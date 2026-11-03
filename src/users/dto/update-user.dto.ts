import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

/**
 * The shape of the JSON body for `PATCH /users/:id`.
 *
 * `PartialType(CreateUserDto)` builds a new class with the SAME fields and the SAME validation rules
 * as CreateUserDto, but makes every field optional. So:
 * - `{ "name": "Ravi K" }`          → valid (only the name changes)
 * - `{ "email": "nope" }`           → 400 "email must be an email" (the rule is still there)
 * - `{ "role": "admin" }`           → 400 (still not an allowed field)
 * We write the rules once, in CreateUserDto, and both DTOs stay in sync.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}
