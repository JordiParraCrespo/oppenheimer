import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  WEBHOOK_BODY_KEPT_CHARS,
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
} from '@oppenheimer/shared/automations';
import type { RunWebhookPayload } from './automation-run.entity';

/**
 * A routine's webhook: its token, the signature a signed one carries, and
 * what of a posted body its run keeps. Pure, so each rule is a unit test.
 */

const TOKEN_PREFIX = 'owh_';
const SECRET_PREFIX = 'owhsec_';
/** How much of the token the Routines tab shows to tell one URL from the next. */
const SHOWN_CHARS = 6;

export interface IssuedToken {
  /** Shown once, in the URL; never stored. */
  token: string;
  /** SHA-256 hex: what is stored and looked up. */
  hash: string;
  /** `owh_ab12cd`: shown beside the URL afterwards, not a secret. */
  prefix: string;
}

export function issueWebhookToken(): IssuedToken {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return {
    token,
    hash: webhookTokenHash(token),
    prefix: token.slice(0, TOKEN_PREFIX.length + SHOWN_CHARS),
  };
}

export function webhookTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A token as it can appear in a URL; anything else is not looked up at all. */
export function isWebhookTokenShaped(value: string): boolean {
  return /^owh_[A-Za-z0-9_-]{43}$/.test(value);
}

export function issueSigningSecret(): string {
  return `${SECRET_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export type SignatureVerdict = 'valid' | 'missing' | 'malformed' | 'stale' | 'mismatch';

/**
 * Checks `x-oppenheimer-signature: t=<unix seconds>,v1=<hex>`, where the hex is
 * HMAC-SHA256 under the signing secret of `<t>.<raw body>`: Stripe's scheme,
 * which most senders can produce. A timestamp further than the tolerance from
 * now is stale, so a captured request cannot be replayed later. Several `v1`
 * values are allowed, any one matching.
 */
export function verifyWebhookSignature(
  secret: string,
  header: string | undefined,
  rawBody: Buffer,
  now: Date,
): SignatureVerdict {
  if (!header?.trim()) return 'missing';
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't' && value) timestamp = value;
    if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return 'malformed';
  const skew = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (skew > WEBHOOK_SIGNATURE_TOLERANCE_SECONDS) return 'stale';
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const matches = signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    return timingSafeEqual(Buffer.from(candidate, 'hex'), expected);
  });
  return matches ? 'valid' : 'mismatch';
}

/**
 * What a run keeps of a posted body: its text, cut to `WEBHOOK_BODY_KEPT_CHARS`
 * and marked when cut, and the content type without its parameters. Bytes that
 * are not UTF-8, and NUL, which Postgres `jsonb` refuses, are kept as the
 * replacement character, never as binary.
 */
export function webhookPayloadOf(
  rawBody: Buffer,
  contentType: string | undefined,
): RunWebhookPayload {
  const text = rawBody.toString('utf8').replaceAll('\u0000', '\uFFFD');
  const truncated = text.length > WEBHOOK_BODY_KEPT_CHARS;
  const type =
    contentType?.split(';', 1)[0]?.trim().toLowerCase().replaceAll('\u0000', '').slice(0, 100) ||
    null;
  return {
    contentType: type,
    body: truncated ? `${text.slice(0, WEBHOOK_BODY_KEPT_CHARS)}…` : text,
    bodyTruncated: truncated,
  };
}
