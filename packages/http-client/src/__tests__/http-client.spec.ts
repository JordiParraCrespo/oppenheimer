import { describe, expect, it, vi } from 'vitest';
import { HttpClient, HttpTransportError } from '../http-client';
import { readProblem } from '../problem';

/**
 * The transport both `opp` and the MCP server call the API through. What a
 * request carries and what a failed answer says are decided here once; each
 * client only maps a status onto its own vocabulary.
 */

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const clientWith = (fetchImpl: typeof fetch) =>
  new HttpClient({ apiUrl: 'https://api.example.com/', token: 'oppenheimer_pat_test', fetchImpl });

describe('a request', () => {
  it('goes under /api/v1 with the bearer credential, and the API root when absolute', async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    const client = clientWith(fetchImpl);

    await client.request({ method: 'GET', path: '/hosts' });
    await client.request({ method: 'POST', path: '/api/auth/sign-in/email', absolute: true });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.example.com/api/v1/hosts');
    expect((fetchImpl.mock.calls[0][1].headers as Record<string, string>).authorization).toBe(
      'Bearer oppenheimer_pat_test',
    );
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.example.com/api/auth/sign-in/email');
  });

  it('carries no credential header without a token, as the sign-in call must', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, {}));
    await new HttpClient({ apiUrl: 'https://api.example.com', fetchImpl }).request({
      method: 'GET',
      path: '/health',
    });

    expect(
      (fetchImpl.mock.calls[0][1].headers as Record<string, string>).authorization,
    ).toBeUndefined();
  });

  it('leaves empty query values out instead of sending them blank', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, {}));
    await clientWith(fetchImpl).request({
      method: 'GET',
      path: '/sessions',
      query: { limit: 25, hostId: undefined, state: '', cursor: null },
    });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.example.com/api/v1/sessions?limit=25');
  });

  it('sends a write’s own headers, an idempotency key among them', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(201, {}));
    await clientWith(fetchImpl).request({
      method: 'POST',
      path: '/sessions',
      body: { task: 't' },
      headers: { 'idempotency-key': 'k-1' },
    });

    const init = fetchImpl.mock.calls[0][1];
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('k-1');
    expect(init.body).toBe('{"task":"t"}');
  });
});

describe('an answer', () => {
  it('comes back whatever its status, with its headers, so the caller decides what it means', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(403, { code: 'TOKEN_005' }, { 'x-a': '1' }));

    const response = await clientWith(fetchImpl).request({ method: 'GET', path: '/hosts' });

    expect(response).toMatchObject({ status: 403, ok: false, payload: { code: 'TOKEN_005' } });
    expect(response.headers.get('x-a')).toBe('1');
  });

  it('has no payload for a 204, and a proxy’s plain text as its message', async () => {
    const empty = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const html = vi.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));

    expect(
      (await clientWith(empty).request({ method: 'DELETE', path: '/x' })).payload,
    ).toBeUndefined();
    expect((await clientWith(html).request({ method: 'GET', path: '/x' })).payload).toEqual({
      message: '<html>502</html>',
    });
  });
});

describe('no answer at all', () => {
  it('is an unreachable API, told apart from an API that said no', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      clientWith(fetchImpl).request({ method: 'GET', path: '/hosts' }),
    ).rejects.toMatchObject({
      name: 'HttpTransportError',
      kind: 'unreachable',
    });
  });

  it('is a timeout once the time runs out', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    ) as unknown as typeof fetch;
    const client = new HttpClient({ apiUrl: 'https://api.example.com', timeoutMs: 10, fetchImpl });

    const error = await client.request({ method: 'GET', path: '/hosts' }).catch((e) => e);

    expect(error).toBeInstanceOf(HttpTransportError);
    expect((error as HttpTransportError).kind).toBe('timeout');
  });
});

describe('readProblem', () => {
  it('reads a problem document by its detail and code, naming the rejected fields', () => {
    expect(
      readProblem(
        {
          type: 'https://oppenheimer.dev/errors#validation',
          title: 'Validation failed',
          status: 400,
          detail: 'The body did not match.',
          code: 'VALIDATION_FAILED',
          correlationId: 'req-7',
          invalidParams: [{ name: 'scopes.0', reason: 'Invalid scope' }],
        },
        'fallback',
      ),
    ).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'The body did not match. (scopes.0: Invalid scope)',
      correlationId: 'req-7',
    });
  });

  it('falls back to the title when there is no detail', () => {
    expect(readProblem({ type: 'about:blank', title: 'Forbidden', status: 403 }, 'f').message).toBe(
      'Forbidden',
    );
  });

  it('still reads an older deployment’s body, and joins its list of messages', () => {
    expect(readProblem({ code: 'TOKEN_009', message: ['a', 'b'] }, 'f')).toEqual({
      code: 'TOKEN_009',
      message: 'a; b',
      correlationId: undefined,
    });
    expect(readProblem(undefined, 'GET /x failed with 500').message).toBe('GET /x failed with 500');
  });
});
