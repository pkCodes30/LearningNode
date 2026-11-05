import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import type { TestProject } from 'vitest/node';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Prepares the test database. Vitest runs this once, before any e2e test file (vitest.config.e2e.ts).
 * After it, the tests always start from the same state: the current schema, and no rows.
 */
export default async function setup(project: TestProject): Promise<void> {
  const url = project.config.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in vitest.config.e2e.ts');
  }
  const databaseName = new URL(url).pathname.slice(1);

  // SAFETY CHECK: the code below empties every table. If a config mistake ever pointed this at the dev
  // or production database, it would wipe real data. So stop unless the name clearly says "test".
  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing to reset "${databaseName}": not a test database`);
  }

  // `migrate deploy` creates the database if it's missing, then applies any migrations not yet applied.
  // It's the same command production uses (Day 27), so the tests run on the real schema.
  // We pass DATABASE_URL explicitly, because the Prisma CLI runs as a separate process.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe', // keep the output quiet; if it fails, the thrown error includes it
  });

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    // Ask Postgres for all our tables, so new models (products, orders…) are covered automatically.
    // `_prisma_migrations` stays: it's Prisma's record of which migrations were applied.
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

    if (tables.length > 0) {
      const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
      // `$executeRawUnsafe` because table names can't be query parameters. It's safe here: the names
      // come from Postgres itself, never from user input (SQL injection is on Day 19).
      // RESTART IDENTITY: ids start from 1 again. CASCADE: also clears rows that reference these tables.
      await prisma.$executeRawUnsafe(
        `TRUNCATE ${names} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
