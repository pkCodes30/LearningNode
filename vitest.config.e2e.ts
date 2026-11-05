import 'dotenv/config';
import { defineConfig } from 'vitest/config';

/**
 * e2e tests create and delete rows, so they must never touch the dev database.
 * We take the normal DATABASE_URL and change ONLY the database name:
 *   …/learning_node?schema=public  →  …/learning_node_test?schema=public
 * Nothing new to configure, and no extra secret to keep: the same works locally and in CI (Day 13).
 */
function testDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing: copy .env.example to .env');
  }
  const url = new URL(process.env.DATABASE_URL);
  if (!url.pathname.endsWith('_test')) {
    url.pathname += '_test';
  }
  return url.toString();
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Set for every test. ConfigModule gives the real environment priority over `.env` (notes/10 §6.3),
    // so the app under test connects to the test database without any change to the app's code.
    env: { DATABASE_URL: testDatabaseUrl() },
    // Runs ONCE before all the test files: creates, migrates and empties the test database.
    globalSetup: ['./test/global-setup.ts'],
  },
});
