import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    constructor(queue: unknown) {
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

const { setupBullBoard } = await import('./bull-board.setup');

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

  it('resolves each queue by its BullMQ DI token', () => {
    // `app.get('email')` returns nothing useful — the queue is registered under
    // `getQueueToken('email')`. Getting this wrong yields a board with no
    // queues rather than an error.
    const { instance, get } = app();

    setupBullBoard(instance, ['email', 'webhook'], { auth });

    expect(get).toHaveBeenCalledWith(getQueueToken('email'));
    expect(get).toHaveBeenCalledWith(getQueueToken('webhook'));
  });

  it('wraps every queue in an adapter and hands them to the board', () => {
    const { instance } = app();

    setupBullBoard(instance, ['email', 'webhook', 'notifications'], { auth });

    expect(BullMQAdapterCtor).toHaveBeenCalledTimes(3);
    expect(createBullBoard).toHaveBeenCalledWith(
      expect.objectContaining({ queues: expect.any(Array) }),
    );
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

  it('mounts a board with no queues rather than failing', () => {
    // A deployment may register no queues at all. The route should still exist
    // and say so, instead of the call throwing during bootstrap.
    const { instance, use } = app();

    expect(() => setupBullBoard(instance, [], { auth })).not.toThrow();
    expect(use).toHaveBeenCalled();
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
      auth: { username: 'operator', password: 'part:two' },
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
    const encoded = Buffer.from('operator:part:two').toString('base64');

    middleware({ headers: { authorization: `Basic ${encoded}` } }, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(response.status).not.toHaveBeenCalled();
  });
});
