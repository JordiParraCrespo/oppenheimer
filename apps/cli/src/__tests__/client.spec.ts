import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '../lib/client';
import { type CliError, ExitCode } from '../lib/errors';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const clientWith = (fetchImpl: typeof fetch, token = 'oppenheimer_pat_test') =>
  new ApiClient({ apiUrl: 'https://api.example.com/', token, fetchImpl });

describe('request building', () => {
  it('prefixes /api/v1 and sends the bearer credential', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { ok: true }));
    await clientWith(fetchImpl).get('/users');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/users');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer oppenheimer_pat_test',
    );
  });

  it('skips the version prefix for absolute paths', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, {}));
    await clientWith(fetchImpl).post('/api/auth/sign-in/email', {
      absolute: true,
    });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.example.com/api/auth/sign-in/email');
  });

  it('drops empty query parameters instead of sending blanks', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, {}));
    await clientWith(fetchImpl).get('/users', {
      query: { page: 2, search: undefined, role: '' },
    });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.example.com/api/v1/users?page=2');
  });

  it('omits the credential header when there is no token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, {}));
    await new ApiClient({ apiUrl: 'https://api.example.com', fetchImpl }).get('/health');

    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('hands response headers to the caller', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, {}, { 'set-auth-token': 'session-123' }));
    let seen: string | null = null;

    await clientWith(fetchImpl).post('/whatever', {
      onHeaders: (headers) => {
        seen = headers.get('set-auth-token');
      },
    });

    expect(seen).toBe('session-123');
  });

  it('returns undefined for a 204', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(clientWith(fetchImpl).delete('/tokens/1')).resolves.toBeUndefined();
  });
});

describe('error translation', () => {
  const failing = (status: number, body: unknown) =>
    clientWith(vi.fn().mockResolvedValue(json(status, body))).get('/users');

  it('maps 401 to the auth exit code, with a next step', async () => {
    const error = (await failing(401, { message: 'Unauthorized' }).catch((e) => e)) as CliError;

    expect(error.exitCode).toBe(ExitCode.AUTH);
    expect(error.hint).toMatch(/oppenheimer login/);
  });

  it('maps 403 to the forbidden exit code', async () => {
    const error = (await failing(403, {
      code: 'TOKEN_005',
      message: 'Missing permission',
    }).catch((e) => e)) as CliError;

    expect(error.exitCode).toBe(ExitCode.FORBIDDEN);
    expect(error.message).toContain('TOKEN_005');
  });

  it('maps 404 to the not-found exit code', async () => {
    const error = (await failing(404, { message: 'Not found' }).catch((e) => e)) as CliError;
    expect(error.exitCode).toBe(ExitCode.NOT_FOUND);
  });

  it('maps anything else to a generic failure', async () => {
    const error = (await failing(500, { message: 'Boom' }).catch((e) => e)) as CliError;
    expect(error.exitCode).toBe(ExitCode.FAILURE);
  });

  it('joins the array of messages a legacy validation error returns', async () => {
    const error = (await failing(400, {
      message: ['name is required', 'scopes is required'],
    }).catch((e) => e)) as CliError;

    expect(error.message).toContain('name is required; scopes is required');
  });

  it('reports a problem document by its detail and code', async () => {
    const error = (await failing(404, {
      type: 'https://oppenheimer.dev/errors#token_001',
      title: 'Token not found',
      status: 404,
      detail: 'No token with id abc',
      code: 'TOKEN_001',
    }).catch((e) => e)) as CliError;

    expect(error.exitCode).toBe(ExitCode.NOT_FOUND);
    expect(error.message).toBe('TOKEN_001: No token with id abc');
  });

  it('falls back to the problem title when there is no detail', async () => {
    const error = (await failing(403, {
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
    }).catch((e) => e)) as CliError;

    expect(error.message).toBe('Forbidden');
  });

  it('spells out which fields a validation problem rejected', async () => {
    const error = (await failing(400, {
      type: 'https://oppenheimer.dev/errors#validation_failed',
      title: 'Validation failed',
      status: 400,
      detail: 'The request body did not match the expected schema.',
      code: 'VALIDATION_FAILED',
      invalidParams: [
        { name: 'name', reason: 'Required' },
        { name: 'scopes.0', reason: 'Invalid scope' },
      ],
    }).catch((e) => e)) as CliError;

    expect(error.message).toContain('name: Required; scopes.0: Invalid scope');
  });

  it('reports an unreachable API distinctly from an API that said no', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const error = (await clientWith(fetchImpl)
      .get('/users')
      .catch((e) => e)) as CliError;

    expect(error.exitCode).toBe(ExitCode.UNREACHABLE);
    expect(error.message).toContain('Could not reach');
  });

  it('reports a timeout as unreachable', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const error = (await clientWith(vi.fn().mockRejectedValue(abort))
      .get('/users')
      .catch((e) => e)) as CliError;

    expect(error.exitCode).toBe(ExitCode.UNREACHABLE);
    expect(error.message).toContain('timed out');
  });

  it('survives a non-JSON error body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    const error = (await clientWith(fetchImpl)
      .get('/users')
      .catch((e) => e)) as CliError;

    expect(error.message).toContain('<html>502</html>');
  });
});
