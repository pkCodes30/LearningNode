// `enableImplicitConversion` (below) reads each field's TypeScript type from decorator metadata, via
// `Reflect.getMetadata`. Inside the Nest app, Nest loads `reflect-metadata` for us, but a unit test of
// this file alone doesn't, and failed with "Reflect.getMetadata is not a function". So import it here.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/** The environments this app knows about. Anything else is a typo, so we reject it. */
export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test', // vitest sets NODE_ENV=test while the tests run
}

/**
 * Every environment variable the app needs, with its rules: a DTO for the environment.
 *
 * It works exactly like a request DTO (notes/08 §2): class-validator decorators describe the rules,
 * and a field initializer (`= 3000`) gives a default when the variable is missing.
 * Everything in the environment arrives as a STRING ("3000"), so `validateEnv` converts it first.
 */
export class EnvironmentVariables {
  // ⚠️ Read the rules below from the BOTTOM up. Decorators are applied bottom-up, so class-validator
  // checks the one closest to the field FIRST, and `stopAtFirstError` (in validateEnv) keeps only the
  // first failure. So the most basic rule ("is it a number at all?") must sit at the bottom.
  // With @IsInt() on top instead, PORT=abc said "PORT must not be greater than 65535". True, but useless.

  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // A real TCP port: a whole number from 1 to 65535.
  @Max(65535)
  @Min(1)
  @IsInt() // checked first
  PORT: number = 3000;

  // No default on purpose: without a database the app is useless, so a missing value must stop it.
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL must start with postgres:// or postgresql://',
  })
  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is missing' }) // checked first
  DATABASE_URL: string;
}

/**
 * Checks the environment ONCE, at startup. ConfigModule.forRoot({ validate: validateEnv }) calls it with
 * every variable it found (from `.env` and from the real process environment).
 *
 * "Fail fast": if anything is wrong, throw right now, so the app refuses to start with one clear message.
 * The alternative is starting "fine" and crashing later, on the first request that touches a broken
 * setting, maybe at 2 a.m. in production.
 *
 * Returns the checked AND converted values (PORT as a number). ConfigService serves these from now on.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  // Step 1: plain object → class instance. `enableImplicitConversion` uses each field's TypeScript type
  // to convert: "3000" → 3000 for `PORT: number`. Missing fields keep their defaults from the class.
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  // Step 2: run the decorator rules. `stopAtFirstError` = one message per variable (PORT=abc says
  // "must be an integer" once, instead of also "must not be less than 1" and "…greater than 65535").
  const errors = validateSync(env, { stopAtFirstError: true });

  if (errors.length > 0) {
    // Each error has `constraints`, like { isInt: 'PORT must be an integer number' }. Collect ALL the
    // messages, so the person fixing the .env sees every problem at once, not one per restart.
    const problems = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `Invalid environment variables:\n  - ${problems.join('\n  - ')}`,
    );
  }

  return env;
}
