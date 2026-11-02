// Day 9 acceptance tests for /users. Claude wrote these; YOU write the code in src/users/ that makes them pass.
//   npm run test:e2e                     → everything
//   npm run test:e2e -- -t "part 1"      → only part 1 (create + read)
// They use the real local DB. Every user they create has an email starting with "e2e-",
// and they delete those users at the end.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const MISSING_ID = 999999999;
const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@shop.dev`;

interface UserJson {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

describe('/users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // The same global pipe as src/main.ts. createNestApplication() does NOT run main.ts,
    // so without this line these tests would run with no validation at all.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await app.close();
  });

  describe('part 1: create + read', () => {
    const email = uniqueEmail('asha');
    let created: UserJson;

    it('POST /users creates a user → 201 + the user as JSON', async () => {
      const res = await api().post('/users').send({ email, name: 'Asha' }).expect(201);
      expect(res.body).toMatchObject({ email, name: 'Asha' });
      expect(typeof res.body.id).toBe('number');
      expect(res.body.createdAt).toBeDefined();
      created = res.body;
    });

    it('POST /users without a name → 201 (name is optional)', async () => {
      const res = await api().post('/users').send({ email: uniqueEmail('noname') }).expect(201);
      expect(res.body.name).toBeNull();
    });

    it('POST /users with a bad email → 400', async () => {
      const res = await api().post('/users').send({ email: 'not-an-email' }).expect(400);
      expect(res.body.message).toContain('email must be an email');
    });

    it('POST /users with an unknown field (mass assignment) → 400', async () => {
      const res = await api()
        .post('/users')
        .send({ email: uniqueEmail('hacker'), role: 'admin' })
        .expect(400);
      expect(res.body.message).toContain('property role should not exist');
    });

    it('POST /users with an email that already exists → 409', async () => {
      await api().post('/users').send({ email }).expect(409);
    });

    it('GET /users → 200 + an array that includes the new user', async () => {
      const res = await api().get('/users').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect((res.body as UserJson[]).some((user) => user.id === created.id)).toBe(true);
    });

    it('GET /users/:id → 200 + that user', async () => {
      const res = await api().get(`/users/${created.id}`).expect(200);
      expect(res.body).toMatchObject({ id: created.id, email, name: 'Asha' });
    });

    it('GET /users/abc → 400 (the id must be a number)', async () => {
      const res = await api().get('/users/abc').expect(400);
      expect(res.body.message).toContain('numeric string is expected');
    });

    it(`GET /users/${MISSING_ID} → 404`, async () => {
      await api().get(`/users/${MISSING_ID}`).expect(404);
    });
  });

  describe('part 2: update + delete', () => {
    let ravi: { id: number; email: string };
    let meera: { id: number; email: string };

    // These users are created straight in the DB, so part 2 works even before POST does.
    beforeAll(async () => {
      ravi = await prisma.user.create({ data: { email: uniqueEmail('ravi'), name: 'Ravi' } });
      meera = await prisma.user.create({ data: { email: uniqueEmail('meera') } });
    });

    it('PATCH /users/:id changes only the sent fields → 200', async () => {
      const res = await api().patch(`/users/${ravi.id}`).send({ name: 'Ravi K' }).expect(200);
      expect(res.body).toMatchObject({ id: ravi.id, email: ravi.email, name: 'Ravi K' });
    });

    it('PATCH /users/:id with a bad email → 400', async () => {
      await api().patch(`/users/${ravi.id}`).send({ email: 'nope' }).expect(400);
    });

    it("PATCH /users/:id with someone else's email → 409", async () => {
      await api().patch(`/users/${ravi.id}`).send({ email: meera.email }).expect(409);
    });

    it(`PATCH /users/${MISSING_ID} → 404`, async () => {
      await api().patch(`/users/${MISSING_ID}`).send({ name: 'Ghost' }).expect(404);
    });

    it('DELETE /users/:id → 204 with an empty body, then GET → 404', async () => {
      const res = await api().delete(`/users/${meera.id}`).expect(204);
      expect(res.text).toBe('');
      await api().get(`/users/${meera.id}`).expect(404);
    });

    it(`DELETE /users/${MISSING_ID} → 404`, async () => {
      await api().delete(`/users/${MISSING_ID}`).expect(404);
    });
  });
});
