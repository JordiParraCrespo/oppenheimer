import { describe, expect, it, vi } from 'vitest';
import { OppenheimerApiError, OppenheimerClient } from '../client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

const clientWith = (fetchImpl: typeof fetch) =>
  new OppenheimerClient({
    apiUrl: 'https://api.example.com',
    token: 'oppenheimer_pat_test',
    fetchImpl,
  });

const failWith = (status: number, body: unknown) =>
  clientWith(vi.fn().mockResolvedValue(json(status, body)))
    .get('/users')
    .catch((error) => error as OppenheimerApiError);

describe('problem details', () => {
  it('reports the occurrence detail and the catalog code', async () => {
    const error = await failWith(404, {
      type: 'https://oppenheimer.dev/errors#user_001',
      title: 'User not found',
      status: 404,
      detail: 'No user with id 42',
      code: 'USER_001',
      correlationId: 'req-7',
    });

    expect(error.status).toBe(404);
    expect(error.code).toBe('USER_001');
    expect(error.message).toBe('No user with id 42');
    expect(error.correlationId).toBe('req-7');
  });

  it('falls back to the problem title when there is no detail', async () => {
    const error = await failWith(403, {
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
    });

    expect(error.message).toBe('Forbidden');
    expect(error.isPermissionError).toBe(true);
  });

  it('names the rejected fields so a tool can fix its arguments', async () => {
    const error = await failWith(400, {
      title: 'Validation failed',
      status: 400,
      detail: 'The request body did not match the expected schema.',
      code: 'VALIDATION_FAILED',
      invalidParams: [{ name: 'scopes.0', reason: 'Invalid scope' }],
    });

    expect(error.message).toContain('scopes.0: Invalid scope');
    expect(error.invalidParams).toEqual([{ name: 'scopes.0', reason: 'Invalid scope' }]);
  });

  it('still understands a deployment that answers with the legacy body', async () => {
    const error = await failWith(409, {
      code: 'TOKEN_009',
      message: 'Token limit reached',
    });

    expect(error.code).toBe('TOKEN_009');
    expect(error.message).toBe('Token limit reached');
  });

  it('survives a proxy answering with something that is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    const error = (await clientWith(fetchImpl)
      .get('/users')
      .catch((e) => e)) as OppenheimerApiError;

    expect(error.status).toBe(502);
    expect(error.message).toContain('<html>502</html>');
  });
});
