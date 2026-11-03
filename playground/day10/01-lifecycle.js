var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import 'reflect-metadata';
import { BadRequestException, Catch, Controller, Get, HttpException, Injectable, Module, Param, Query, UseFilters, UseGuards, UseInterceptors, } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { tap } from 'rxjs';
const log = (msg) => console.log(`   ${msg}`);
let LogMiddleware = class LogMiddleware {
    use(_req, _res, next) {
        log('1. middleware');
        next();
    }
};
LogMiddleware = __decorate([
    Injectable()
], LogMiddleware);
let DemoGuard = class DemoGuard {
    canActivate(ctx) {
        const deny = ctx.switchToHttp().getRequest().query.deny === '1';
        log(`2. guard → ${deny ? 'DENY' : 'allow'}`);
        return !deny;
    }
};
DemoGuard = __decorate([
    Injectable()
], DemoGuard);
let DemoInterceptor = class DemoInterceptor {
    intercept(_ctx, next) {
        log('3. interceptor (before)');
        return next.handle().pipe(tap(() => log('6. interceptor (after)')));
    }
};
DemoInterceptor = __decorate([
    Injectable()
], DemoInterceptor);
class DemoPipe {
    transform(value) {
        log(`4. pipe ('${value}')`);
        const id = Number(value);
        if (Number.isNaN(id))
            throw new BadRequestException('id must be a number');
        return id;
    }
}
let DemoFilter = class DemoFilter {
    catch(exception, host) {
        const status = exception instanceof HttpException ? exception.getStatus() : 500;
        log(`7. exception filter (${status})`);
        host
            .switchToHttp()
            .getResponse()
            .status(status)
            .json({ statusCode: status, message: exception.message });
    }
};
DemoFilter = __decorate([
    Catch()
], DemoFilter);
let DemoController = class DemoController {
    find(id, fail) {
        log(`5. handler (id = ${id})`);
        if (fail === '1')
            throw new Error('handler blew up');
        return { id };
    }
};
__decorate([
    Get(':id'),
    __param(0, Param('id', DemoPipe)),
    __param(1, Query('fail')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", void 0)
], DemoController.prototype, "find", null);
DemoController = __decorate([
    Controller('demo'),
    UseGuards(DemoGuard),
    UseInterceptors(DemoInterceptor),
    UseFilters(DemoFilter)
], DemoController);
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(LogMiddleware).forRoutes(DemoController);
    }
};
AppModule = __decorate([
    Module({ controllers: [DemoController] })
], AppModule);
const app = await NestFactory.create(AppModule, { logger: false });
await app.listen(0);
const base = `http://localhost:${app.getHttpServer().address().port}`;
for (const path of ['/demo/5', '/demo/5?deny=1', '/demo/abc', '/demo/5?fail=1']) {
    console.log(`GET ${path}`);
    const res = await fetch(base + path);
    console.log(`   → ${res.status} ${await res.text()}`);
}
await app.close();
