// Day 11 · Circular dependency, BROKEN version: UsersService needs OrdersService, and OrdersService
// needs UsersService. Each lives in its own file and imports the other (like a real project).
import { Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

@Injectable()
export class UsersService {
  constructor(readonly orders: OrdersService) {}
}
