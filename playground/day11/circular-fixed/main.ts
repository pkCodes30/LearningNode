// The fixed version. Run:
//   npx tsc -p playground/day11 && node playground/day11/dist/circular-fixed/main.js
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { UsersService } from './users.service.js';
import { OrdersService } from './orders.service.js';

@Module({ providers: [UsersService, OrdersService] })
class AppModule {}

const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
const users = app.get(UsersService);
const orders = app.get(OrdersService);
console.log('started            :', users.orders instanceof OrdersService);
console.log('users.orders.users :', users.orders.users === users);
console.log('orders.users.orders:', orders.users.orders === orders);
await app.close();
