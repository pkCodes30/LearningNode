import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { UsersService } from './users.service.js';
import type { WrapperType } from './wrapper-type.js';

@Injectable()
export class OrdersService {
  constructor(@Inject(forwardRef(() => UsersService)) readonly users: WrapperType<UsersService>) {}
}
