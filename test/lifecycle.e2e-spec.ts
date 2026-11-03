// Day 10 acceptance tests: the request-id middleware, the timing interceptor and the Prisma filter.
//   npm run test:e2e -- -t "lifecycle"
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('request lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // No useGlobal…() calls here: the middleware, interceptor and filter must come from AppModule.
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'e2e-lifecycle-' } },
    });
    await app.close();
  });

  it('gives every response a new x-request-id (a UUID) when the client sends none', async () => {
    const first = await api().get('/health').expect(200);
    const second = await api().get('/health').expect(200);
    expect(first.headers['x-request-id']).toMatch(UUID);
    expect(second.headers['x-request-id']).toMatch(UUID);
    expect(first.headers['x-request-id']).not.toBe(
      second.headers['x-request-id'],
    );
  });

  it('reuses the x-request-id the client sent', async () => {
    const res = await api()
      .get('/health')
      .set('x-request-id', 'trace-abc-123')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('trace-abc-123');
  });

  it('replaces an absurdly long incoming x-request-id with a fresh UUID', async () => {
    const res = await api()
      .get('/health')
      .set('x-request-id', 'x'.repeat(500))
      .expect(200);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('sets x-request-id on error responses too (middleware runs first)', async () => {
    const res = await api().get('/users/abc').expect(400);
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('adds X-Response-Time like "3ms" to successful responses', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.headers['x-response-time']).toMatch(/^\d+ms$/);
  });

  it('turns a Prisma P2002 (duplicate) into 409 instead of 500', async () => {
    const email = `e2e-lifecycle-${Date.now()}@shop.dev`;
    await api().post('/users').send({ email }).expect(201);
    const res = await api().post('/users').send({ email }).expect(409);
    expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('turns a Prisma P2025 (record not found) into 404 instead of 500', async () => {
    const res = await api().delete('/users/999999999').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });
});
