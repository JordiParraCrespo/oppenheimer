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

export type SignatureCheck =
  | { verdict: 'valid'; timestamp: string }
  | { verdict: Exclude<SignatureVerdict, 'valid'> };

/**
 * Checks `x-oppenheimer-signature: t=<unix seconds>,v1=<hex>`, where the hex is
 * HMAC-SHA256 under the signing secret of `<t>.<raw body>`: Stripe's scheme,
 * which most senders can produce. A timestamp further than the tolerance from
 * now is stale, so a captured request cannot be replayed later. Several `v1`
 * values are allowed, any one matching; a second `t` is malformed, since a
 * prefixed one would otherwise give a used signature a new replay key. A valid
 * check answers the timestamp it verified, which is what the replay key is
 * built from.
 */
export function verifyWebhookSignature(
  secret: string,
  header: string | undefined,
  rawBody: Buffer,
  now: Date,
): SignatureCheck {
  if (!header?.trim()) return { verdict: 'missing' };
  const timestamps: string[] = [];
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') timestamps.push(value ?? '');
    if (key === 'v1' && value) signatures.push(value);
  }
  const [timestamp] = timestamps;
  if (
    timestamps.length !== 1 ||
    !timestamp ||
    !/^\d{1,12}$/.test(timestamp) ||
    signatures.length === 0
  ) {
    return { verdict: 'malformed' };
  }
  const skew = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (skew > WEBHOOK_SIGNATURE_TOLERANCE_SECONDS) return { verdict: 'stale' };
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const matches = signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    return timingSafeEqual(Buffer.from(candidate, 'hex'), expected);
  });
  return matches ? { verdict: 'valid', timestamp } : { verdict: 'mismatch' };
}

/**
 * How long a signature is remembered once used: as long as its timestamp
 * could still pass, which is the tolerance either side of now.
 */
export const SIGNATURE_REPLAY_TTL_SECONDS = 2 * WEBHOOK_SIGNATURE_TOLERANCE_SECONDS + 1;

/**
 * What a valid signature is remembered by, so the same request posted again
 * inside its window is refused: the routine, the signed timestamp and a digest
 * of the body. Under one secret those decide the signature, and no secret or
 * signature is kept. The `Idempotency-Key` is no part of it: it is not signed,
 * so anyone replaying a request could change it. `timestamp` is the one
 * `verifyWebhookSignature` checked, never parsed again from the header.
 */
export function signatureReplayKey(
  automationId: string,
  timestamp: string,
  rawBody: Buffer,
): string {
  const body = createHash('sha256').update(rawBody).digest('hex');
  return `routine-webhook:signature:${automationId}:${timestamp}:${body}`;
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
    body: truncated ? `${keptPrefix(text, WEBHOOK_BODY_KEPT_CHARS)}…` : text,
    bodyTruncated: truncated,
  };
}

/**
 * The first `length` UTF-16 units of `text`, one fewer when the cut would
 * split a surrogate pair: a lone surrogate is JSON Postgres `jsonb` refuses.
 */
function keptPrefix(text: string, length: number): string {
  const last = text.charCodeAt(length - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? length - 1 : length);
}
