// Nest decorators · Demo 4: "enhancer" decorators (@UseGuards, @UseInterceptors, @UseFilters, @Catch)
// and making your OWN decorators (@Public, @Roles, @CurrentUser, @Auth).
// Fake login: send the header  x-user: "name:role"  (real JWT auth comes on Day 22).
// PREDICT the ⚠️ lines first, then run:
//   npx tsc -p playground/nest-decorators && node playground/nest-decorators/dist/04-enhancers-custom.js
import {
  type ArgumentsHost,
  type CallHandler,
  type CanActivate,
  Catch,
  Controller,
  Delete,
  type ExceptionFilter,
  type ExecutionContext,
  Get,
  Injectable,
  Module,
  type NestInterceptor,
  NotFoundException,
  Post,
  SetMetadata,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
  applyDecorators,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map } from 'rxjs';
import { boot, call } from './_helpers.js';

interface User {
  name: string;
  role: string;
}
type AuthedRequest = Request & { user?: User };

// ── Custom decorators ──────────────────────────────────────────────
// 1. A metadata sticker the old way: SetMetadata(key, value)
const IS_PUBLIC = 'isPublic';
const Public = () => SetMetadata(IS_PUBLIC, true);

// 2. A metadata sticker the newer, type-safe way
const Roles = Reflector.createDecorator<string[]>();

// 3. A param decorator: pulls the logged-in user out of the request
const CurrentUser = createParamDecorator((field: keyof User | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  return field ? user?.[field] : user;
});

// ── Enhancers ──────────────────────────────────────────────────────
@Injectable()
class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // the method's sticker wins over the class's sticker
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers['x-user'];
    if (typeof header !== 'string') throw new UnauthorizedException('login first');
    const [name, role] = header.split(':');
    req.user = { name, role };

    const roles = this.reflector.get(Roles, ctx.getHandler());
    return !roles || roles.includes(role); // false → 403
  }
}

@Injectable()
class WrapInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(map((data) => ({ data, wrappedBy: 'WrapInterceptor' })));
  }
}

class OutOfStockError extends Error {}

@Catch(OutOfStockError) // this filter handles ONLY OutOfStockError
class OutOfStockFilter implements ExceptionFilter {
  catch(err: OutOfStockError, host: ArgumentsHost) {
    host.switchToHttp().getResponse<Response>().status(409).json({ error: 'OUT_OF_STOCK', message: err.message });
  }
}

// 4. Combine many decorators into ONE
function Auth(...roles: string[]) {
  return applyDecorators(UseGuards(AuthGuard), Roles(roles));
}

// ── Controllers ────────────────────────────────────────────────────
@Controller('shop')
@UseGuards(AuthGuard) // every route in this class is protected…
@UseInterceptors(WrapInterceptor)
class ShopController {
  @Public() // …except this one
  @Get('products')
  products() {
    return ['pen', 'book'];
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  @Get('my-name')
  myName(@CurrentUser('name') name: string) {
    return { name };
  }

  @Roles(['admin'])
  @Delete('products/1')
  deleteProduct() {
    return { deleted: 1 };
  }

  @Public()
  @Post('orders')
  @UseFilters(OutOfStockFilter)
  order() {
    throw new OutOfStockError('only 0 pens left');
  }

  @Public()
  @Get('products/99')
  missing() {
    throw new NotFoundException('product 99 not found');
  }

  @Public()
  @Get('crash') // ⚠️
  crash() {
    throw new Error('db password is hunter2');
  }
}

@Controller('admin')
class AdminController {
  @Auth('admin') // = @UseGuards(AuthGuard) + @Roles(['admin'])
  @Get('stats')
  stats() {
    return { orders: 42 };
  }
}

@Module({ controllers: [ShopController, AdminController] })
class DemoModule {}

const alice = { 'x-user': 'alice:admin' };
const bob = { 'x-user': 'bob:customer' };

const { app, base } = await boot(DemoModule);
console.log('── @UseGuards + @Public + @UseInterceptors');
await call(base, 'GET', '/shop/products');
await call(base, 'GET', '/shop/me');
await call(base, 'GET', '/shop/me', { headers: bob });
await call(base, 'GET', '/shop/my-name', { headers: bob });
console.log('── @Roles');
await call(base, 'DELETE', '/shop/products/1', { headers: bob });
await call(base, 'DELETE', '/shop/products/1', { headers: alice });
console.log('── Errors: @UseFilters + @Catch, HttpException, plain Error');
await call(base, 'POST', '/shop/orders');
await call(base, 'GET', '/shop/products/99');
await call(base, 'GET', '/shop/crash');
console.log('── applyDecorators: @Auth("admin")');
await call(base, 'GET', '/admin/stats', { headers: bob });
await call(base, 'GET', '/admin/stats', { headers: alice });
await app.close();
