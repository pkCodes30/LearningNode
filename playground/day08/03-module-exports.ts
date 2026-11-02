// Day 8 · Module walls: OrdersService (in OrdersModule) wants UsersService (in UsersModule).
// PREDICT: does Nest give it, when UsersModule does NOT export it? And when it does? Run both:
//   npx tsc -p playground/day08 && node playground/day08/dist/03-module-exports.js
//   node playground/day08/dist/03-module-exports.js export

import 'reflect-metadata';
import { Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

let created = 0;

@Injectable()
class UsersService {
  readonly id = ++created; // counts how many UsersService objects Nest creates
}

@Injectable()
class OrdersService {
  constructor(readonly users: UsersService) {}
}

const exportIt = process.argv[2] === 'export';

@Module({ providers: [UsersService], exports: exportIt ? [UsersService] : [] })
class UsersModule {}

@Module({ imports: [UsersModule], providers: [OrdersService] })
class OrdersModule {}

console.log(`UsersModule exports UsersService: ${exportIt}`);
try {
  const app = await NestFactory.createApplicationContext(OrdersModule, {
    logger: false,
    abortOnError: false, // throw instead of killing the process, so we can print the error
  });
  const orders = app.get(OrdersService);
  console.log('✅ OrdersService got a UsersService:', orders.users instanceof UsersService);
  console.log('UsersService objects created:', created);
  await app.close();
} catch (err) {
  console.log('❌', (err as Error).message.split('\n')[0]);
}
