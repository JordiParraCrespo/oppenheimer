import { RequestContextService } from '@oppenheimer/backend-ddd';
import { describe, expect, it, vi } from 'vitest';
import { RequestContextMiddleware } from '../request-context.middleware';

function run(req: { headers: Record<string, unknown>; id?: unknown }) {
  const setHeader = vi.fn();
  let seen: string | undefined;
  new RequestContextMiddleware().use(req, { setHeader }, () => {
    seen = RequestContextService.getCorrelationId();
  });
  return { setHeader, seen };
}

describe('RequestContextMiddleware', () => {
  it('opens the context for everything after it, with the id echoed on the response', () => {
    const req = { headers: { 'x-correlation-id': 'client-id' } };
    const { setHeader, seen } = run(req);

    expect(seen).toBe('client-id');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'client-id');
    expect(req).toMatchObject({ id: 'client-id' });
  });

  it('reuses the id pino-http already assigned', () => {
    const { seen } = run({ id: 'pino-id', headers: { 'x-correlation-id': 'client-id' } });

    expect(seen).toBe('pino-id');
  });

  it('keeps the context across async continuations of next()', async () => {
    let seen: string | undefined;
    await new Promise<void>((resolve) => {
      new RequestContextMiddleware().use(
        { headers: { 'x-correlation-id': 'async-id' } },
        { setHeader: vi.fn() },
        () => {
          setTimeout(() => {
            seen = RequestContextService.getCorrelationId();
            resolve();
          }, 0);
        },
      );
    });

    expect(seen).toBe('async-id');
  });

  it('does not leak the context outside the request', () => {
    run({ headers: {} });

    expect(RequestContextService.getCorrelationId()).toBeUndefined();
  });
});
