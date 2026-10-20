// A tiny DI container (~15 lines), the same idea Nest uses.
// Run: node playground/decorators-di/02-mini-di.js

class Container {
  #instances = new Map(); // token (the class) → the object already created (singleton cache)

  get(Token) {
    if (this.#instances.has(Token)) return this.#instances.get(Token); // already made? reuse it
    const deps = (Token.inject ?? []).map((Dep) => this.get(Dep)); // build its helpers first
    const names = deps.map((d) => d.constructor.name).join(', ');
    console.log(`  creating ${Token.name}${names ? ` with [${names}]` : ''}`);
    const instance = new Token(...deps);
    this.#instances.set(Token, instance);
    return instance;
  }

  override(Token, fake) {
    this.#instances.set(Token, fake); // for tests: swap in a fake
  }
}

// In Nest, TypeScript writes the dependency list for you:
//   __metadata("design:paramtypes", [PrismaService])   ← see dist/health/health.controller.js
// Here we write it by hand as `static inject = [...]`.

class ConfigService {
  get(key) {
    return { DATABASE_URL: 'postgres://localhost/learning_node' }[key];
  }
}

class PrismaService {
  static inject = [ConfigService];
  constructor(config) {
    this.url = config.get('DATABASE_URL');
  }
  query() {
    return `SELECT 1 ran on ${this.url}`;
  }
}

class HealthController {
  static inject = [PrismaService];
  constructor(prisma) {
    this.prisma = prisma;
  }
  check() {
    return this.prisma.query();
  }
}

class UsersController {
  static inject = [PrismaService];
  constructor(prisma) {
    this.prisma = prisma;
  }
}

console.log('1) Ask the container for HealthController:');
const app = new Container();
const health = app.get(HealthController);
console.log('  →', health.check());

console.log('\n2) Ask for UsersController (it also needs PrismaService):');
const users = app.get(UsersController);
console.log('  same PrismaService object shared?', users.prisma === health.prisma);

console.log('\n3) Testing: swap in a FAKE PrismaService (no real DB):');
class FakePrismaService {
  query() {
    return 'fake result 😎';
  }
}
const testApp = new Container();
testApp.override(PrismaService, new FakePrismaService());
console.log('  →', testApp.get(HealthController).check());
