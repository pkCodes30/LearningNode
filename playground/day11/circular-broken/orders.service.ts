import { Injectable } from '@nestjs/common';
import { UsersService } from './users.service.js';

@Injectable()
export class OrdersService {
  constructor(readonly users: UsersService) {}
}
