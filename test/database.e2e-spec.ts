import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

describe('database (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app.close();
  });

  it('runs against the test database, never the dev one', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    // Ask Postgres itself which database this app is really connected to.
    const [{ name }] = await app.get(PrismaService).$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;

    expect(name).toMatch(/_test$/);
  });

  it('GET /health answers 500 without leaking details when the database is down', async () => {
    // overrideProvider: the WHOLE real app, but with one piece swapped. It's the way to test failures
    // you can't easily cause for real, like a database outage. No real DB connection is made here.
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
      })
      .compile();
    // `logger: false` keeps the expected error out of the test output.
    app = moduleFixture.createNestApplication({ logger: false });
    await app.init();

    const res = await request(app.getHttpServer()).get('/health').expect(500);

    expect(res.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
  });
});
