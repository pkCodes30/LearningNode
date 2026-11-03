import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
// Normal imports (not `import type`): the ValidationPipe needs these DTO classes at runtime.
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

/**
 * The HTTP layer for /users: a "thin controller".
 *
 * Each method only reads the request (with decorators), calls the service and returns the result.
 * Nest turns the returned object or array into a JSON response. All the real logic lives in
 * UsersService, and DB errors become 404/409 in the global PrismaExceptionFilter.
 */
@Controller('users') // every route in this class starts with /users
export class UsersController {
  // DI again: Nest creates UsersService once and passes it in here.
  constructor(private readonly usersService: UsersService) {}

  // POST /users → 201 Created (Nest's default for POST) + the saved user as JSON.
  // @Body() = the parsed JSON body. By the time we get it, the global ValidationPipe has already
  // checked it against CreateUserDto (bad input never reaches this line).
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // GET /users → 200 + an array of users.
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // GET /users/5 → 200 + one user (or 404, thrown by the service).
  // URL params always arrive as TEXT ('5'). ParseIntPipe turns '5' into the number 5, and for
  // 'abc' it answers 400 "Validation failed (numeric string is expected)" before this method runs.
  // That's why `id` can honestly be typed as `number` here (no more `+id`).
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  // PATCH /users/5 → 200 + the updated user. Only the fields in the body change.
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  // DELETE /users/5 → 204 No Content: it worked, and there's nothing to send back.
  // @HttpCode overrides Nest's default 200 for this one route.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
