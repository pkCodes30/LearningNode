// Day 8 · How does Nest "know" what to create and inject? It reads metadata that the decorators
// (and TypeScript's emitDecoratorMetadata) stored on your classes. This reads the SAME metadata.
// Needs a fresh build first:
//   npm run build && node playground/day08/01-metadata.mjs

import 'reflect-metadata';
import { UsersModule } from '../../dist/users/users.module.js';
import { UsersController } from '../../dist/users/users.controller.js';
import { UsersService } from '../../dist/users/users.service.js';

const meta = (key, target) => Reflect.getMetadata(key, target);
const names = (list) => list?.map((item) => item.name);

console.log('@Module      controllers :', names(meta('controllers', UsersModule)));
console.log('@Module      providers   :', names(meta('providers', UsersModule)));
console.log('@Injectable  on service  :', meta('__injectable__', UsersService));
console.log('@Controller  path        :', meta('path', UsersController));
console.log('constructor  needs       :', names(meta('design:paramtypes', UsersController)));
console.log('@Get(":id")  path        :', meta('path', UsersController.prototype.findOne));
console.log('@Get(":id")  method      :', meta('method', UsersController.prototype.findOne), '(0 = GET in RequestMethod)');
