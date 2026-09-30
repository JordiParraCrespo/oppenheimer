import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Bull Board is an admin surface over live queues. Two things about the wiring
 * matter and neither is visible at a glance: that it resolves each queue by the
 * BullMQ DI token (resolving by name silently yields nothing), and that the
 * router is mounted under the same base path the adapter was told about — a
 * mismatch renders a dashboard whose own asset and API URLs 404.
 */

const createBullBoard = vi.fn();
const setBasePath = vi.fn();
const getRouter = vi.fn(() => 'the-router');
const BullMQAdapterCtor = vi.fn();

vi.mock('@bull-board/api', () => ({
  createBullBoard: (options: unknown) => createBullBoard(options),
}));

vi.mock('@bull-board/api/bullMQAdapter', () => ({
  BullMQAdapter: class {
    constructor(readonly queue: unknown) {
      BullMQAdapterCtor(queue);
    }
  },
}));

vi.mock('@bull-board/express', () => ({
  ExpressAdapter: class {
    setBasePath = setBasePath;
    getRouter = getRouter;
  },
}));

const { BULL_BOARD_MIN_PASSWORD_LENGTH, setupBullBoard } = await import('./bull-board.setup');

function app() {
  const use = vi.fn();
  const queues = new Map<string, { name: string }>();
  const get = vi.fn((token: unknown) => {
    const queue = { name: String(token) };
    queues.set(String(token), queue);
    return queue;
  });

  return {
    instance: {
      get,
      getHttpAdapter: () => ({ getInstance: () => ({ use }) }),
    } as unknown as INestApplication,
    get,
    use,
  };
}

describe('setupBullBoard', () => {
  const auth = { username: 'operator', password: 'correct horse battery staple' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves each queue by its BullMQ DI token and hands it to the board', () => {
    // `app.get('email')` returns nothing useful — the queue is registered under
    // `getQueueToken('email')`. Getting this wrong yields a board with no
    // queues rather than an error.
    const { instance, get } = app();

    setupBullBoard(instance, ['email', 'webhook'], { auth });

    expect(get).toHaveBeenCalledWith(getQueueToken('email'));
    expect(get).toHaveBeenCalledWith(getQueueToken('webhook'));
    expect(BullMQAdapterCtor.mock.calls).toEqual([
      [{ name: getQueueToken('email') }],
      [{ name: getQueueToken('webhook') }],
    ]);
    const resolved = get.mock.results.map((result) => result.value);
    const boarded = createBullBoard.mock.calls[0]?.[0].queues as { queue: unknown }[];
    expect(boarded).toHaveLength(2);
    for (const [index, adapter] of boarded.entries()) expect(adapter.queue).toBe(resolved[index]);
  });

  it('mounts the router at the same base path the adapter was given', () => {
    // The adapter builds its own asset and API URLs from the base path. Mounting
    // elsewhere produces a page that loads and then 404s on everything it needs.
    const { instance, use } = app();

    setupBullBoard(instance, ['email'], { basePath: '/ops/queues', auth });

    expect(setBasePath).toHaveBeenCalledWith('/ops/queues');
    expect(use).toHaveBeenCalledWith('/ops/queues', expect.any(Function), 'the-router');
  });

  it('defaults the base path to /admin/queues', () => {
    const { instance, use } = app();

    setupBullBoard(instance, ['email'], { auth });

    expect(setBasePath).toHaveBeenCalledWith('/admin/queues');
    expect(use).toHaveBeenCalledWith('/admin/queues', expect.any(Function), 'the-router');
  });

  it('does not mount the dashboard when credentials are omitted', () => {
    const { instance, get, use } = app();

    expect(setupBullBoard(instance, ['email'])).toBe(false);
    expect(get).not.toHaveBeenCalled();
    expect(createBullBoard).not.toHaveBeenCalled();
    expect(use).not.toHaveBeenCalled();
  });

  it('guards the dashboard with HTTP Basic authentication', () => {
    const { instance, use } = app();
    setupBullBoard(instance, ['email'], { auth });
    const middleware = use.mock.calls[0]?.[1] as (
      request: { headers: { authorization?: string } },
      response: {
        setHeader: ReturnType<typeof vi.fn>;
        status: ReturnType<typeof vi.fn>;
        send: ReturnType<typeof vi.fn>;
      },
      next: ReturnType<typeof vi.fn>,
    ) => void;
    const next = vi.fn();
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const setHeader = vi.fn();

    middleware({ headers: {} }, { setHeader, status, send }, next);

    expect(setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="Bull Board", charset="UTF-8"',
    );
    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith('Authentication required.');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows valid HTTP Basic credentials, including colons in the password', () => {
    const { instance, use } = app();
    setupBullBoard(instance, ['email'], {
      auth: { username: 'operator', password: 'part-one-long:two' },
    });
    const middleware = use.mock.calls[0]?.[1] as (
      request: { headers: { authorization?: string } },
      response: unknown,
      next: ReturnType<typeof vi.fn>,
    ) => void;
    const next = vi.fn();
    const response = {
      setHeader: vi.fn(),
      status: vi.fn(() => ({ send: vi.fn() })),
      send: vi.fn(),
    };
    const encoded = Buffer.from('operator:part-one-long:two').toString('base64');

    middleware({ headers: { authorization: `Basic ${encoded}` } }, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('refuses to mount behind a password short enough to guess', () => {
    const { instance, use } = app();

    expect(
      setupBullBoard(instance, ['email'], {
        auth: { username: 'operator', password: 'x'.repeat(BULL_BOARD_MIN_PASSWORD_LENGTH - 1) },
      }),
    ).toBe(false);
    expect(use).not.toHaveBeenCalled();
    expect(
      setupBullBoard(instance, ['email'], {
        auth: { username: 'operator', password: 'x'.repeat(BULL_BOARD_MIN_PASSWORD_LENGTH) },
      }),
    ).toBe(true);
  });

  describe('failed sign-in limit', () => {
    type Middleware = (
      request: { ip?: string; headers: { authorization?: string } },
      response: Reply,
      next: () => void,
    ) => void;

    interface Reply {
      statusCode?: number;
      headers: Record<string, string>;
      setHeader(name: string, value: string): void;
      status(code: number): { send(body: string): void };
    }

    function reply(): Reply {
      const r: Reply = {
        headers: {},
        setHeader(name, value) {
          r.headers[name] = value;
        },
        status(code) {
          r.statusCode = code;
          return { send: () => {} };
        },
      };
      return r;
    }

    function mounted(options: { maxTrackedClients?: number } = {}): Middleware {
      const { instance, use } = app();
      setupBullBoard(instance, ['email'], { auth, ...options });
      return use.mock.calls[0]?.[1] as Middleware;
    }

    const basic = (user: string, pass: string) =>
      `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

    function attempt(middleware: Middleware, ip: string, pass = 'wrong password, sorry') {
      const response = reply();
      const next = vi.fn();
      middleware({ ip, headers: { authorization: basic('operator', pass) } }, response, next);
      return { status: response.statusCode, headers: response.headers, next };
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('answers 429 with Retry-After from the eleventh failure, without checking the credentials', () => {
      const middleware = mounted();
      for (let i = 0; i < 10; i += 1) {
        expect(attempt(middleware, '203.0.113.7').status).toBe(401);
      }

      const limited = attempt(middleware, '203.0.113.7');
      expect(limited.status).toBe(429);
      expect(Number(limited.headers['Retry-After'])).toBeGreaterThan(0);
      // Regression: the right password is not even looked at past the limit.
      const right = attempt(middleware, '203.0.113.7', auth.password);
      expect(right.status).toBe(429);
      expect(right.next).not.toHaveBeenCalled();
    });

    it('limits one address, not everyone', () => {
      const middleware = mounted();
      for (let i = 0; i < 11; i += 1) attempt(middleware, '203.0.113.7');

      expect(attempt(middleware, '198.51.100.2').status).toBe(401);
      expect(attempt(middleware, '198.51.100.2', auth.password).next).toHaveBeenCalledOnce();
    });

    it('lets the address in again once the window has passed', () => {
      vi.useFakeTimers();
      const middleware = mounted();
      for (let i = 0; i < 11; i += 1) attempt(middleware, '203.0.113.7');
      expect(attempt(middleware, '203.0.113.7', auth.password).status).toBe(429);

      vi.advanceTimersByTime(15 * 60_000);

      expect(attempt(middleware, '203.0.113.7', auth.password).next).toHaveBeenCalledOnce();
    });

    it('does not count a request that presents no credential', () => {
      const middleware = mounted();
      for (let i = 0; i < 20; i += 1) {
        const response = reply();
        middleware({ ip: '203.0.113.7', headers: {} }, response, vi.fn());
        expect(response.statusCode).toBe(401);
      }
      expect(attempt(middleware, '203.0.113.7', auth.password).next).toHaveBeenCalledOnce();
    });

    it('forgets the oldest address once it tracks as many as it may', () => {
      const middleware = mounted({ maxTrackedClients: 2 });
      for (let i = 0; i < 10; i += 1) attempt(middleware, '203.0.113.1');
      // Two more addresses: the first is dropped to make room, so its count is
      // gone rather than the map growing.
      attempt(middleware, '203.0.113.2');
      attempt(middleware, '203.0.113.3');

      expect(attempt(middleware, '203.0.113.1').status).toBe(401);
    });
  });
});
