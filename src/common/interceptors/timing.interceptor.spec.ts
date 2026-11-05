import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { TimingInterceptor } from './timing.interceptor.js';

/**
 * UNIT test of the interceptor. An interceptor receives `next` and returns an Observable, so we:
 * - fake `next` with `of(value)`, an Observable that emits that value at once (a "handler that worked"),
 * - use `lastValueFrom()` to turn the Observable into a promise we can `await`. Nothing runs until then.
 */
describe('TimingInterceptor', () => {
  const interceptor = new TimingInterceptor();
  const response = { setHeader: vi.fn() };

  // The fake ExecutionContext: only the path the interceptor walks.
  const context = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds X-Response-Time and passes the handler result through unchanged', async () => {
    const next: CallHandler = { handle: () => of({ id: 1 }) };

    const result = await lastValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({ id: 1 });
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Response-Time',
      expect.stringMatching(/^\d+ms$/),
    );
  });

  it('adds no header when the handler fails (tap only runs on success)', async () => {
    const failure = new Error('handler blew up');
    const next: CallHandler = { handle: () => throwError(() => failure) };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(failure);
    expect(response.setHeader).not.toHaveBeenCalled();
  });
});
