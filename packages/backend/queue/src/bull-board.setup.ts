import { timingSafeEqual } from 'node:crypto';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';

/**
 * The shortest password the dashboard accepts. Its Basic auth is the only
 * thing between the network and every queued job, so a password short enough
 * to guess leaves the dashboard unmounted instead.
 */
export const BULL_BOARD_MIN_PASSWORD_LENGTH = 16;

const DEFAULT_MAX_FAILURES = 10;
const DEFAULT_FAILURE_WINDOW_MS = 15 * 60_000;
/** Addresses the limiter remembers at once, so it is no memory-exhaustion vector itself. */
const DEFAULT_MAX_TRACKED_CLIENTS = 10_000;

/** HTTP Basic credentials guarding the dashboard. Both fields are required. */
export interface BullBoardAuth {
  username: string;
  password: string;
}

export interface BullBoardOptions {
  basePath?: string;
  /**
   * When set, the dashboard is guarded by HTTP Basic auth with these
   * credentials. When omitted, the dashboard is NOT mounted at all — its job
   * payloads carry tokenized password-reset/invitation URLs, so an
   * unauthenticated dashboard is an account-takeover surface. A password
   * shorter than {@link BULL_BOARD_MIN_PASSWORD_LENGTH} is treated the same way.
   */
  auth?: BullBoardAuth;
  /**
   * Failed sign-ins one client address may make per `failureWindowMs` before
   * it is answered `429` without its credentials being checked. Default 10.
   */
  maxFailures?: number;
  /** The window failures are counted over, in milliseconds. Default 15 minutes. */
  failureWindowMs?: number;
  /** The most client addresses the limiter tracks; the oldest goes first. Default 10 000. */
  maxTrackedClients?: number;
}

/** Constant-time comparison that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

interface FailureCount {
  count: number;
  resetAt: number;
}

/**
 * Failed sign-ins per client address, in this process.
 *
 * The dashboard is raw Express middleware, so the API's own throttler never
 * sees it, and nothing else would stop an online guess. Expiry is lazy (a
 * client's count is dropped when it is next looked at past its window) and the
 * map is capped, dropping the oldest entry, so a flood of addresses cannot
 * grow it without bound. It is per replica: a client spread across N replicas
 * gets N times the attempts, which is acceptable for a break-glass dashboard
 * that belongs behind an allowlist anyway.
 */
class FailureLimiter {
  private readonly clients = new Map<string, FailureCount>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly maxClients: number,
  ) {}

  /** Seconds until the client may try again, or 0 when it may try now. */
  retryAfter(client: string, now: number): number {
    const entry = this.current(client, now);
    if (!entry || entry.count < this.maxFailures) return 0;
    return Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  }

  fail(client: string, now: number): void {
    const entry = this.current(client, now);
    if (entry) {
      entry.count += 1;
      return;
    }
    if (this.clients.size >= this.maxClients) {
      const oldest = this.clients.keys().next().value;
      if (oldest !== undefined) this.clients.delete(oldest);
    }
    this.clients.set(client, { count: 1, resetAt: now + this.windowMs });
  }

  private current(client: string, now: number): FailureCount | undefined {
    const entry = this.clients.get(client);
    if (entry && entry.resetAt <= now) {
      this.clients.delete(client);
      return undefined;
    }
    return entry;
  }
}

function basicAuthMiddleware(auth: BullBoardAuth, limiter: FailureLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // `req.ip` honours Express's `trust proxy`, which the API sets from
    // TRUST_PROXY, so behind a proxy this is the client and not the proxy.
    const client = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const now = Date.now();
    const wait = limiter.retryAfter(client, now);
    if (wait > 0) {
      // Not even checked: past the limit an attempt tells the guesser nothing.
      res.setHeader('Retry-After', String(wait));
      res.status(429).send('Too many failed attempts.');
      return;
    }
    const header = req.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [user, ...passParts] = Buffer.from(encoded, 'base64').toString('utf8').split(':');
      const pass = passParts.join(':');
      // Compare both fields regardless of the first result so the response time
      // does not reveal whether the username matched.
      const userOk = safeEqual(user, auth.username);
      const passOk = safeEqual(pass, auth.password);
      if (userOk && passOk) {
        next();
        return;
      }
      // Only a presented credential counts: a browser's first request carries
      // none, and that is not a guess.
      limiter.fail(client, now);
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board", charset="UTF-8"');
    res.status(401).send('Authentication required.');
  };
}

/**
 * Mount the Bull Board dashboard. Returns `true` if it was mounted, `false` if
 * it was skipped because no credentials were supplied or the password is
 * shorter than {@link BULL_BOARD_MIN_PASSWORD_LENGTH} — the caller can log the
 * outcome so a self-hoster learns the dashboard is off.
 *
 * The dashboard is raw Express middleware attached to the HTTP adapter, so
 * NestJS global guards (`AuthGuard`/`ScopesGuard`) and the API's throttler
 * never see it. That is exactly why it carries its own auth and its own limit
 * on failed attempts: without them it would expose every queued job —
 * including password-reset and invitation tokens — to anyone who can reach the
 * host, or who can guess for long enough.
 */
export function setupBullBoard(
  app: INestApplication,
  queueNames: string[],
  options: BullBoardOptions = {},
): boolean {
  const basePath = options.basePath ?? '/admin/queues';
  if (!options.auth) return false;
  if (options.auth.password.length < BULL_BOARD_MIN_PASSWORD_LENGTH) return false;

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  const queues = queueNames.map((name) => {
    const queue = app.get<Queue>(getQueueToken(name));
    return new BullMQAdapter(queue);
  });

  createBullBoard({ queues, serverAdapter });

  const limiter = new FailureLimiter(
    options.maxFailures ?? DEFAULT_MAX_FAILURES,
    options.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS,
    options.maxTrackedClients ?? DEFAULT_MAX_TRACKED_CLIENTS,
  );

  // Mount on the underlying Express instance: its `use` is variadic, so the
  // Basic-auth gate runs before the dashboard router. Nest's abstract adapter
  // `use` is typed for at most two arguments.
  const expressApp = app.getHttpAdapter().getInstance() as {
    use: (path: string, ...handlers: unknown[]) => void;
  };
  expressApp.use(basePath, basicAuthMiddleware(options.auth, limiter), serverAdapter.getRouter());
  return true;
}
