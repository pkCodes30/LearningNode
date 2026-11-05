// Day 11 · Circular dependency, FIXED version: forwardRef on BOTH sides.
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import type { WrapperType } from './wrapper-type.js';

@Injectable()
export class UsersService {
  constructor(
    // forwardRef(() => OrdersService): "ask me for the class LATER, it may not exist yet right now".
    @Inject(forwardRef(() => OrdersService)) readonly orders: WrapperType<OrdersService>,
  ) {}
}
