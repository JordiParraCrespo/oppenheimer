import { isAbsolute, resolve } from 'node:path';
import { registerAs } from '@nestjs/config';
import { findWorkspaceRoot } from '@oppenheimer/env';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * `LOG_FILE` as the path the loggers write to: a relative one is taken from
 * the repository root, blank is none. Shared by the request logger (through
 * this config) and the Better Auth route logger, which is built before
 * config is.
 */
export function resolveLogFile(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return isAbsolute(value) ? value : resolve(findWorkspaceRoot() ?? process.cwd(), value);
}

const schema = z.object({
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  // **Required** — the app must fail fast and loud at boot without it. Only
  // keys whose absence removes an optional feature (OAuth, S3, SMTP)
  // get the optional-capability treatment; see `capabilities.module.ts`.
  betterAuthSecret: z.string().min(8),
  betterAuthUrl: z.string().url().default('http://localhost:3001'),
  frontendUrl: z.string().url().default('http://localhost:3000'),
  // Base of the RFC 7807 `type` URIs in error responses. Point it at wherever
  // this deployment documents its error catalog.
  errorTypeBaseUrl: z.string().url().default('https://oppenheimer.dev/errors'),
  // Number of reverse-proxy hops in front of the API (Express `trust proxy`).
  // 0 = trust none (direct connection). Behind nginx/ingress set it to the
  // hop count so `req.ip` is the real client — the throttler's auth-failure
  // budget keys on it and API-token IP allowlists check it. Never blindly trust all
  // proxies (`true`), which lets a client spoof `X-Forwarded-For`.
  trustProxy: z.coerce.number().int().min(0).default(0),
  // **Optional capability** — the Bull Board queue dashboard at `/admin/queues`
  // is mounted only when BOTH credentials are set and the password is at least
  // `BULL_BOARD_MIN_PASSWORD_LENGTH` long, and then behind HTTP Basic auth.
  // Otherwise the dashboard is not exposed at all: its job
  // payloads carry tokenized password-reset/invitation URLs, so it must never
  // be public.
  bullBoardUsername: z.string().optional(),
  bullBoardPassword: z.string().optional(),
  // **Optional** — a file the API also writes its log lines to, as JSON, for a
  // shipper to tail (`pnpm monitoring:up` runs Grafana Alloy over `.logs/`,
  // into Loki). Unset, logs go to stdout only. A relative path is taken from
  // the repository root, so `.logs/api.log` is the same file wherever the
  // API is started from.
  logFile: z.string().optional().transform(resolveLogFile),
});

export const appConfig = registerAs('app', () =>
  parseEnv('app', schema, {
    port: 'PORT',
    nodeEnv: 'NODE_ENV',
    betterAuthSecret: 'BETTER_AUTH_SECRET',
    betterAuthUrl: 'BETTER_AUTH_URL',
    frontendUrl: 'FRONTEND_URL',
    errorTypeBaseUrl: 'ERROR_TYPE_BASE_URL',
    trustProxy: 'TRUST_PROXY',
    bullBoardUsername: 'BULL_BOARD_USERNAME',
    bullBoardPassword: 'BULL_BOARD_PASSWORD',
    logFile: 'LOG_FILE',
  }),
);
