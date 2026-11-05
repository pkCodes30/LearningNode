import { Logger, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaExceptionFilter } from './prisma-exception.filter.js';

/**
 * UNIT test of the filter. It has no dependencies, so no Nest testing module is needed: plain `new`.
 *
 * The filter only touches `host` and `response`, so we fake just those two.
 * This is the "real logic" of the error handling: which Prisma code becomes which status.
 */
describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  // The fake Express response. `mockReturnThis()` makes `.status(409).json(…)` chaining work,
  // because `status()` returns the same object, just like the real one.
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

  // The fake ArgumentsHost. Only the path the filter really walks: host.switchToHttp().getResponse().
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  // A REAL Prisma error object, with only the code changed: the same class the app sees at runtime.
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError(`secret SQL details for ${code}`, {
      code,
      clientVersion: 'test',
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turns P2002 (duplicate) into a 409', () => {
    filter.catch(prismaError('P2002'), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'Conflict' }),
    );
  });

  it('turns P2025 (record not found) into a 404', () => {
    filter.catch(prismaError('P2025'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, error: 'Not Found' }),
    );
  });

  it('answers a generic 500 for any other code, and logs the details instead of leaking them', () => {
    // A SPY: watches a real method. `mockImplementation` also silences it, to keep the output clean.
    const logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(prismaError('P2003'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    // Nothing from the Prisma error may reach the client…
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain(
      'secret SQL',
    );
    // …but we must be able to find it in our logs.
    expect(logged).toHaveBeenCalledWith(
      'Unhandled Prisma error P2003',
      expect.any(String),
    );

    logged.mockRestore(); // put the real logger back for the other tests
  });
});
