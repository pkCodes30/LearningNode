// Nest decorators · Demo 2: route decorators (@Get, @Post, @HttpCode, @Header, @Redirect)
// and param decorators (@Param, @Query, @Body, @Headers, @Ip, @Req, @Res).
// PREDICT the ⚠️ lines first, then run:
//   npx tsc -p playground/nest-decorators && node playground/nest-decorators/dist/02-routes-params.js
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Ip,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Redirect,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { boot, call } from './_helpers.js';

@Controller('products') // every route below starts with /products
class ProductsController {
  @Get() // GET /products?page=2&sort=price
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('sort') sort?: string,
  ) {
    return { page, typeofPage: typeof page, sort: sort ?? null };
  }

  @Get(':id') // GET /products/42
  findOne(@Param('id', ParseIntPipe) id: number) {
    return { id, typeofId: typeof id };
  }

  @Get('search') // ⚠️ declared AFTER ':id'
  search(@Query('q') q: string) {
    return { searching: q };
  }

  @Post() // POST is 201 by default
  create(@Body() body: Record<string, unknown>) {
    return { created: body };
  }

  @Post(':id/archive')
  @HttpCode(200) // nothing new is created, so 200 fits better than 201
  archive(@Param('id', ParseIntPipe) id: number) {
    return { archived: id };
  }

  @Delete(':id')
  @HttpCode(204) // "done, nothing to send back"
  remove(@Param('id', ParseIntPipe) id: number) {
    return { deleted: id }; // ignored: a 204 has no body
  }
}

@Controller('debug')
class DebugController {
  @Get('headers')
  @Header('Cache-Control', 'no-store')
  headers(@Headers('x-request-id') requestId: string, @Ip() ip: string) {
    return { requestId, ip };
  }

  @Get('req')
  raw(@Req() req: Request) {
    return { method: req.method, url: req.originalUrl };
  }

  @Get('res-trap') // ⚠️
  resTrap(@Res() res: Response) {
    return { msg: 'will this be sent?' };
  }

  @Get('res-passthrough')
  passthrough(@Res({ passthrough: true }) res: Response) {
    res.setHeader('X-Powered-By-Me', 'yes');
    return { msg: 'Nest still sends my return value' };
  }

  @Get('old-docs')
  @Redirect('/products', 301)
  oldDocs() {}
}

@Module({ controllers: [ProductsController, DebugController] })
class DemoModule {}

const { app, base } = await boot(DemoModule);
console.log('── @Query / @Param + pipes');
await call(base, 'GET', '/products');
await call(base, 'GET', '/products?page=2&sort=price');
await call(base, 'GET', '/products?page=abc');
await call(base, 'GET', '/products/42');
await call(base, 'GET', '/products/search?q=pen');
console.log('── @Post / @HttpCode / @Delete');
await call(base, 'POST', '/products', { body: { name: 'Pen', price: 10 } });
await call(base, 'POST', '/products/7/archive');
await call(base, 'DELETE', '/products/7');
console.log('── @Header / @Headers / @Ip / @Req / @Res / @Redirect');
await call(base, 'GET', '/debug/headers', { headers: { 'x-request-id': 'abc-123' }, showHeaders: ['cache-control'] });
await call(base, 'GET', '/debug/req?x=1');
await call(base, 'GET', '/debug/res-trap');
await call(base, 'GET', '/debug/res-passthrough', { showHeaders: ['x-powered-by-me'] });
await call(base, 'GET', '/debug/old-docs', { showHeaders: ['location'] });
await app.close();
