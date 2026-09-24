import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

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
  // hop count so `req.ip` is the real client — the throttler keys on it and
  // API-token IP allowlists and audit logs record it. Never blindly trust all
  // proxies (`true`), which lets a client spoof `X-Forwarded-For`.
  trustProxy: z.coerce.number().int().min(0).default(0),
  // **Optional capability** — the Bull Board queue dashboard at `/admin/queues`
  // is mounted only when BOTH credentials are set, and then behind HTTP Basic
  // auth. Absent credentials mean the dashboard is not exposed at all: its job
  // payloads carry tokenized password-reset/invitation URLs, so it must never
  // be public.
  bullBoardUsername: z.string().optional(),
  bullBoardPassword: z.string().optional(),
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
  }),
);
