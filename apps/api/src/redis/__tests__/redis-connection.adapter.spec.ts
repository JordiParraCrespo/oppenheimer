import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisConnectionAdapter } from '../infrastructure/redis-connection.adapter';

const { RedisCtor, on, quit, disconnect } = vi.hoisted(() => ({
  RedisCtor: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: class {
    on = on;
    quit = quit;
    disconnect = disconnect;

    constructor(options: unknown) {
      RedisCtor(options);
    }
  },
}));

function config(): ConfigService {
  const redis = { host: 'redis.internal', port: 6380, password: 's3cret' };
  return { get: (key: string) => (key === 'redis' ? redis : undefined) } as ConfigService;
}

/**
 * The one owner of the API's Redis command connection. What it must guarantee:
 * one socket, built fail-fast from the shared config, never an unhandled
 * `error`, and closed when the app closes.
 */
describe('RedisConnectionAdapter', () => {
  beforeEach(() => {
    RedisCtor.mockClear();
    on.mockClear();
    quit.mockReset();
    disconnect.mockReset();
  });

  it('opens one client with the fail-fast command options', () => {
    new RedisConnectionAdapter(config());

    expect(RedisCtor).toHaveBeenCalledTimes(1);
    expect(RedisCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'redis.internal',
        port: 6380,
        password: 's3cret',
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      }),
    );
  });

  it('listens for errors, so a reconnect attempt is not an unhandled event', () => {
    new RedisConnectionAdapter(config());

    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
    const listener = on.mock.calls.find(([event]) => event === 'error')?.[1];
    expect(() => listener(new Error('ECONNREFUSED'))).not.toThrow();
  });

  it('quits gracefully on shutdown, so pending replies land before the socket goes', async () => {
    // The integration spec sees the client end, which a bare `disconnect` would
    // also do; only here is quit-and-not-drop observable.
    quit.mockResolvedValue('OK');
    const adapter = new RedisConnectionAdapter(config());

    await adapter.onApplicationShutdown();

    expect(quit).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('drops the socket when a graceful quit is refused', async () => {
    quit.mockRejectedValue(new Error('Connection is closed.'));
    const adapter = new RedisConnectionAdapter(config());

    await expect(adapter.onApplicationShutdown()).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
