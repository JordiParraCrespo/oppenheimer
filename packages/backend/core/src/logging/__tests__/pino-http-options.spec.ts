import { describe, expect, it } from 'vitest';
import { buildPinoHttpOptions } from '../pino-http-options';

type SerializerFn = (value: Record<string, unknown>) => Record<string, unknown>;

function serializers() {
  const options = buildPinoHttpOptions();
  return options.serializers as Record<string, SerializerFn>;
}

describe('buildPinoHttpOptions', () => {
  it('logs only known-safe request fields — headers and body never survive', () => {
    const serialized = serializers().req({
      id: 42,
      method: 'POST',
      url: '/api/v1/users',
      remoteAddress: '127.0.0.1',
      headers: {
        cookie: 'better-auth.session_token=secret',
        authorization: 'Bearer token',
      },
      body: { password: 'hunter2' },
      query: { token: 'reset-token' },
    });

    expect(serialized).toEqual({
      id: 42,
      method: 'POST',
      url: '/api/v1/users',
      remoteAddress: '127.0.0.1',
    });
  });

  it('drops the query string from the logged url', () => {
    const serialized = serializers().req({
      url: '/api/auth/reset-password?token=secret-reset-token',
    });

    expect(serialized.url).toBe('/api/auth/reset-password');
  });

  it('logs only the response status code', () => {
    const serialized = serializers().res({
      statusCode: 201,
      headers: { 'set-cookie': 'better-auth.session_token=secret' },
    });

    expect(serialized).toEqual({ statusCode: 201 });
  });

  it('redacts credential-bearing header paths as a backstop', () => {
    const redact = buildPinoHttpOptions().redact as {
      paths: string[];
      remove: boolean;
    };

    expect(redact.remove).toBe(true);
    expect(redact.paths).toEqual(
      expect.arrayContaining([
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["set-cookie"]',
        'res.headers["set-cookie"]',
      ]),
    );
  });

  it('passes the minimum level through, defaulting to pino defaults', () => {
    expect(buildPinoHttpOptions().level).toBeUndefined();
    expect(buildPinoHttpOptions({ level: 'debug' }).level).toBe('debug');
  });

  it('only enables pretty transport when asked to', () => {
    expect(buildPinoHttpOptions().transport).toBeUndefined();
    expect(buildPinoHttpOptions({ pretty: true }).transport).toEqual({
      target: 'pino-pretty',
    });
  });
});
