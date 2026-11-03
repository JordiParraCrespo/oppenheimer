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
});

describe('error translation', () => {
  const failing = (status: number, body: unknown) =>
    clientWith(vi.fn().mockResolvedValue(json(status, body))).get('/users');

  it('maps 401 to the auth exit code, with a next step', async () => {
    const error = (await failing(401, { message: 'Unauthorized' }).catch((e) => e)) as CliError;

    expect(error.exitCode).toBe(ExitCode.AUTH);
    expect(error.hint).toMatch(/opp login/);
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
});
