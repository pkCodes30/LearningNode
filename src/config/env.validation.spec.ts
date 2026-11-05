import { NodeEnv, validateEnv } from './env.validation.js';

// Unit tests for the env check: plain function in, plain values out, no Nest app or DB needed.
const VALID = {
  DATABASE_URL: 'postgresql://shop:secret@localhost:5432/shoplite',
  PORT: '4000', // strings, exactly like real environment variables
  NODE_ENV: 'production',
};

describe('validateEnv', () => {
  it('accepts a valid env and converts PORT from "4000" to the number 4000', () => {
    const env = validateEnv(VALID);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe(NodeEnv.Production);
  });

  it('uses the defaults when PORT and NODE_ENV are missing', () => {
    const env = validateEnv({ DATABASE_URL: VALID.DATABASE_URL });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ PORT: '3000' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not a Postgres URL', () => {
    expect(() =>
      validateEnv({ ...VALID, DATABASE_URL: 'mysql://localhost/shop' }),
    ).toThrow(/must start with postgres/);
  });

  it('rejects a PORT that is not a number', () => {
    expect(() => validateEnv({ ...VALID, PORT: 'abc' })).toThrow(
      /PORT must be an integer number/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV must be one of/,
    );
  });

  it('lists every problem in one message', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /PORT[\s\S]*DATABASE_URL/,
    );
  });
});
