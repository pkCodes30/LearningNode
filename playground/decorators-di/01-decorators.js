// Decorators are just FUNCTIONS. TypeScript turns `@Log` into a normal function call.
// Run: node playground/decorators-di/01-decorators.js
// (Plain JS, because Node can't run decorator syntax directly yet.)

// Helper: this is roughly what TypeScript's compiled `__decorate(...)` does for a method.
function applyDecorator(cls, methodName, decorator) {
  const descriptor = Object.getOwnPropertyDescriptor(cls.prototype, methodName);
  const updated = decorator(cls.prototype, methodName, descriptor) ?? descriptor;
  Object.defineProperty(cls.prototype, methodName, updated);
}

// ── Kind 1: a decorator that CHANGES behaviour (wraps the method) ──
function Log(target, methodName, descriptor) {
  console.log(`  [Log] decorating ${methodName}()`);
  const original = descriptor.value;
  descriptor.value = function (...args) {
    const start = performance.now();
    const result = original.apply(this, args);
    const ms = (performance.now() - start).toFixed(3);
    console.log(`  [Log] ${methodName}(${args.join(', ')}) → ${result} in ${ms} ms`);
    return result;
  };
  return descriptor;
}

// ── Kind 2: a decorator that only adds a STICKER (metadata) ──
// Get('/hello') is a decorator FACTORY: you call it with options and it returns the real decorator.
const routes = []; // Nest stores stickers like these and reads them at startup
function Get(path) {
  return function (target, methodName) {
    console.log(`  [Get] sticker on ${methodName}(): GET ${path}`);
    routes.push({ method: 'GET', path, controller: target.constructor.name, handler: methodName });
  };
}

console.log('1) Defining the class + applying decorators');
class MathController {
  add(a, b) {
    return a + b;
  }
  hello() {
    return 'hi';
  }
}
// In TypeScript you'd write @Log above add() and @Get('/hello') above hello().
applyDecorator(MathController, 'add', Log);
applyDecorator(MathController, 'hello', Get('/hello'));

console.log('\n2) Stickers collected (no object created yet!):');
console.log(routes);

console.log('\n3) Creating an object and calling add() twice');
const m = new MathController();
m.add(2, 3);
m.add(10, 20);
