// Nest decorators · Demo 3: DTO decorators. class-validator (rules) + class-transformer (shape changes),
// checked by the SAME global ValidationPipe as src/main.ts.
// PREDICT the ⚠️ lines first, then run:
//   npx tsc -p playground/nest-decorators && node playground/nest-decorators/dist/03-dtos.js
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Module,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { boot, call } from './_helpers.js';

enum Language {
  English = 'en',
  Hindi = 'hi',
}

class AddressDto {
  @IsString()
  @IsNotEmpty()
  city: string;

  @Matches(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' })
  pincode: string;
}

class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

// Query strings are ALWAYS strings. Same rules, with and without @Type(() => Number).
class QueryWithoutType {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}

class ListProductsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsIn(['price', 'name'])
  sort?: 'price' | 'name';
}

// What we send BACK. @Exclude hides a field, @Expose adds a computed one.
class UserEntity {
  id: number;
  email: string;

  @Exclude()
  passwordHash: string;

  @Expose()
  get displayName() {
    return this.email.split('@')[0];
  }

  constructor(data: Partial<UserEntity>) {
    Object.assign(this, data);
  }
}

const fakeUser = { id: 1, email: 'prakhar@mail.com', passwordHash: '$argon2id$secret' };

@Controller()
class DemoController {
  @Post('users')
  create(@Body() dto: CreateUserDto) {
    return { isDtoInstance: dto instanceof CreateUserDto, dto };
  }

  @Get('products-no-type')
  listNoType(@Query() query: QueryWithoutType) {
    return query;
  }

  @Get('products')
  list(@Query() query: ListProductsQuery) {
    return { ...query, typeofPage: typeof query.page };
  }

  @Get('users/1')
  @UseInterceptors(ClassSerializerInterceptor)
  findOne() {
    return new UserEntity(fakeUser); // a class instance
  }

  @Get('users/1/plain')
  @UseInterceptors(ClassSerializerInterceptor)
  findOnePlain() {
    return { ...fakeUser }; // ⚠️ a plain object
  }
}

@Module({ controllers: [DemoController] })
class DemoModule {}

const goodBody = {
  email: '  Prakhar@Mail.COM ',
  password: 'supersecret',
  address: { city: 'Lucknow', pincode: '226001' },
};

const { app, base } = await boot(DemoModule);
console.log('── @Body() + class-validator');
await call(base, 'POST', '/users', { body: goodBody });
await call(base, 'POST', '/users', {
  body: { email: 'not-an-email', password: 'short', language: 'fr', address: { city: '', pincode: '12' } },
});
await call(base, 'POST', '/users', { body: { ...goodBody, isAdmin: true } });
console.log('── @Query() DTO: why @Type(() => Number)');
await call(base, 'GET', '/products-no-type?page=2');
await call(base, 'GET', '/products');
await call(base, 'GET', '/products?page=2&limit=5&sort=price');
await call(base, 'GET', '/products?page=abc&limit=500&sort=stock');
console.log('── @Exclude / @Expose + ClassSerializerInterceptor');
await call(base, 'GET', '/users/1');
await call(base, 'GET', '/users/1/plain');
await app.close();
