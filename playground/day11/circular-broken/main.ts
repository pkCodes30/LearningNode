// PREDICT: does Nest start? Then run:
//   npx tsc -p playground/day11 && node playground/day11/dist/circular-broken/main.js
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { UsersService } from './users.service.js';
import { OrdersService } from './orders.service.js';

@Module({ providers: [UsersService, OrdersService] })
class AppModule {}

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
console.log('started:', app.get(UsersService).orders instanceof OrdersService);
await app.close();
