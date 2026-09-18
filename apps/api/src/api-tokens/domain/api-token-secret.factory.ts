import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Namespace every issued secret carries, so leaked tokens are recognisable. */
export const API_TOKEN_PREFIX = 'oppenheimer_pat';

/** Bytes of entropy in the secret portion (256 bits). */
const SECRET_BYTES = 32;

/** Characters of the secret kept in the non-secret display prefix. */
const DISPLAY_CHARS = 6;

export interface GeneratedApiTokenSecret {
  /** The full secret. Returned to the caller once and never persisted. */
  secret: string;
  /** Non-secret display prefix, e.g. `oppenheimer_pat_a1b2c3`. */
  prefix: string;
  /** SHA-256 digest of the full secret — this is what gets stored. */
  hash: string;
}

/**
 * Mint a new token secret.
 *
 * The secret is high-entropy and random, so a fast digest is the right hash
 * here: password KDFs exist to slow down guessing of low-entropy inputs, and
 * using one would put a deliberate delay on every authenticated request. What
 * matters is that only the digest is stored and that comparison is constant
 * time.
 */
export function generateApiTokenSecret(): GeneratedApiTokenSecret {
  const random = randomBytes(SECRET_BYTES).toString('base64url');
  const secret = `${API_TOKEN_PREFIX}_${random}`;
  return {
    secret,
    prefix: `${API_TOKEN_PREFIX}_${random.slice(0, DISPLAY_CHARS)}`,
    hash: hashApiTokenSecret(secret),
  };
}

/** SHA-256 digest of a presented secret, in hex. */
export function hashApiTokenSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Does this value look like one of our tokens? Used to route credentials. */
export function isApiTokenSecret(value: string): boolean {
  return value.startsWith(`${API_TOKEN_PREFIX}_`);
}

/** Constant-time digest comparison. */
export function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
