import { describe, expect, it, vi } from 'vitest';
import type { ErrorDefinition } from '../../errors/app.error';
import { UpstreamLimiter } from '../upstream-limiter';

/**
 * The limiter is the one path an adapter's calls take, so what it pins is the
 * order: a call that waited for a slot still checks the pause, a refusal for
 * rate is the system's 429 whatever its status, and a spent budget stops the
 * next call before it is sent.
 */

const LIMITED: ErrorDefinition = { code: 'X_001', message: 'Slow down', httpStatus: 429 };
const OPTIONS = { maxInFlight: 1, maxQueued: 10, maxWaitMs: 1_000 };

function answer(status: number, headers: Record<string, string> = {}, body = '') {
  return {
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    text: vi.fn(async () => body),
  };
}

describe('UpstreamLimiter', () => {
  it('refuses a call that waited for its slot once an earlier call was rate-limited', async () => {
    // The burst case: with one slot, the second call is already queued when the
    // first is refused. It must not be sent.
    const limiter = new UpstreamLimiter('Example', LIMITED, undefined, OPTIONS);
    const send = vi.fn().mockResolvedValueOnce(answer(429, { 'retry-after': '30' }));

    const first = limiter.exchange('app', send);
    const second = limiter.exchange('app', send);

    await expect(first).rejects.toMatchObject({ code: 'X_001', retryAfterSeconds: 30 });
    await expect(second).rejects.toMatchObject({ code: 'X_001' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('takes the adapter’s reading of a refusal body, and pauses the bucket it names', async () => {
    const limiter = new UpstreamLimiter('Example', LIMITED, undefined, OPTIONS);
    const send = vi.fn().mockResolvedValue(answer(403, {}, '{"reason":"projectQuota"}'));

    await expect(
      limiter.exchange(['user:1', 'project'], send, (body) => ({
        limited: body.includes('projectQuota'),
        bucket: 'project',
      })),
    ).rejects.toMatchObject({ code: 'X_001' });

    // Another user shares the project bucket, so it is refused without a call.
    await expect(limiter.exchange(['user:2', 'project'], send)).rejects.toMatchObject({
      code: 'X_001',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('hands back a refusal that is not about rate, with its body read once', async () => {
    const limiter = new UpstreamLimiter('Example', LIMITED, undefined, OPTIONS);
    const response = answer(404, {}, '{"message":"Not Found"}');

    await expect(limiter.exchange('app', async () => response)).resolves.toEqual({
      response,
      errorBody: '{"message":"Not Found"}',
    });
  });

  it('pauses after a success that spent the last call, and never reads a success body', async () => {
    const limiter = new UpstreamLimiter('Example', LIMITED, undefined, OPTIONS);
    const spent = answer(200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '60' });
    const send = vi.fn().mockResolvedValue(spent);

    await expect(limiter.exchange('app', send)).resolves.toMatchObject({ errorBody: null });
    await expect(limiter.exchange('app', send)).rejects.toMatchObject({ code: 'X_001' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(spent.text).not.toHaveBeenCalled();
  });

  it('answers the system’s 429 when too many calls are already waiting', async () => {
    const limiter = new UpstreamLimiter('Example', LIMITED, undefined, {
      ...OPTIONS,
      maxQueued: 0,
    });
    let release!: (value: ReturnType<typeof answer>) => void;
    const busy = limiter.exchange(
      'app',
      () => new Promise<ReturnType<typeof answer>>((resolve) => (release = resolve)),
    );

    await expect(limiter.exchange('app', async () => answer(200))).rejects.toMatchObject({
      code: 'X_001',
    });
    release(answer(200));
    await busy;
  });
});
