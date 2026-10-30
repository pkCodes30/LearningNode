// Shared helpers for the Nest decorator demos.
import { ValidationPipe, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

// Boots a module the same way src/main.ts does (same global ValidationPipe), on a random free port.
export async function boot(module: Type) {
  const app = await NestFactory.create(module, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.listen(0);
  const { port } = app.getHttpServer().address();
  return { app, base: `http://localhost:${port}` };
}

interface CallOptions {
  body?: unknown;
  headers?: Record<string, string>;
  showHeaders?: string[];
}

// Sends one request and prints:  METHOD /path  →  status  body
export async function call(base: string, method: string, path: string, opts: CallOptions = {}) {
  const label = `${method} ${path}`.padEnd(34);
  try {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(1000),
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    const extra = (opts.showHeaders ?? []).map((h) => `  [${h}: ${res.headers.get(h)}]`).join('');
    console.log(`${label} → ${res.status} ${text || '(empty body)'}${extra}`);
  } catch {
    console.log(`${label} → ⏳ no response (gave up after 1 s)`);
  }
}
