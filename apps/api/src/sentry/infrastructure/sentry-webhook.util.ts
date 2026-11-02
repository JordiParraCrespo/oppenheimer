import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Whether `signature` (`Sentry-Hook-Signature`) is the hex HMAC-SHA256 of the
 * exact bytes Sentry sent, under the integration's client secret.
 */
export function verifySentrySignature(
  secret: string,
  payload: Buffer,
  signature: string | undefined,
): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'));
  const presented = Buffer.from(signature.trim().toLowerCase());
  // `timingSafeEqual` throws on a length mismatch; a length is not a secret.
  return expected.length === presented.length && timingSafeEqual(expected, presented);
}

/** SHA-256 hex of the raw bytes: the same signed bytes are one delivery, whatever id they arrive under. */
export function sentryPayloadDigest(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

/** A body the hub can store: a JSON object, or `null`. */
export function parseSentryBody(payload: Buffer): Record<string, unknown> | null {
  try {
    const body: unknown = JSON.parse(payload.toString('utf8'));
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
