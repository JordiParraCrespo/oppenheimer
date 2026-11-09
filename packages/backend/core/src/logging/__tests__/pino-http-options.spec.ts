import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
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

  it('uses the correlation id as the request id and echoes it on the response', () => {
    const genReqId = buildPinoHttpOptions().genReqId as unknown as (
      req: Record<string, unknown>,
      res: { setHeader: (name: string, value: string) => void },
    ) => string;
    const setHeader = vi.fn();

    const id = genReqId({ headers: { 'x-correlation-id': 'client-id' } }, { setHeader });

    expect(id).toBe('client-id');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'client-id');
  });

  it('replaces an invalid inbound correlation id with a fresh UUID', () => {
    const genReqId = buildPinoHttpOptions().genReqId as unknown as (
      req: Record<string, unknown>,
      res: { setHeader: (name: string, value: string) => void },
    ) => string;
    const setHeader = vi.fn();

    const id = genReqId({ headers: { 'x-correlation-id': 'x'.repeat(16_000) } }, { setHeader });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', id);
  });

  it('only enables pretty transport when asked to', () => {
    expect(buildPinoHttpOptions().transport).toBeUndefined();
    expect(buildPinoHttpOptions({ pretty: true }).transport).toEqual({
      target: 'pino-pretty',
    });
  });

  // The file is what Alloy ships to Loki: a line that never reaches it, or
  // reaches it pretty-printed, is a log nobody (and no agent) can query.
  it('also writes JSON lines to the file it is given, with the safety serializers applied', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pino-file-'));
    const file = join(dir, 'nested', 'api.log');
    const options = buildPinoHttpOptions({ pretty: true, file });
    const logger = pino({
      transport: options.transport,
      redact: options.redact,
      serializers: options.serializers,
    } as pino.LoggerOptions);

    logger.info({ req: { url: '/x?token=secret', headers: { cookie: 'c' } } }, 'hello');
    await new Promise<void>((resolve) => logger.flush(() => resolve()));
    await vi.waitFor(
      async () => expect(await readFile(file, 'utf8').catch(() => '')).not.toBe(''),
      {
        timeout: 5_000,
      },
    );

    const line = JSON.parse((await readFile(file, 'utf8')).trim().split('\n')[0] as string);
    expect(line).toMatchObject({ level: 30, msg: 'hello', req: { url: '/x' } });
    expect(line.req.headers).toBeUndefined();
    await rm(dir, { recursive: true, force: true });
  });
});
