import { createHash, randomBytes } from 'node:crypto';

/**
 * The prefix every registration token carries. The runner checks for it before
 * spending one (`apps/runner/internal/pairing/domain/identity.go`), so a user
 * who pastes the wrong secret is told which secret they pasted instead of
 * getting a rejection from the control plane a moment later.
 */
export const PAIRING_TOKEN_PREFIX = 'opr_reg';

/** Bytes of entropy in the secret portion (256 bits). */
const SECRET_BYTES = 32;

/** Characters of the secret kept in the non-secret display prefix. */
const DISPLAY_CHARS = 6;

export interface GeneratedPairingTokenSecret {
  /** The full secret. It goes into the install command and is never stored. */
  secret: string;
  /** Non-secret display prefix, e.g. `opr_reg_a1b2c3`, shown in the token list. */
  prefix: string;
  /** SHA-256 digest of the full secret — this is what gets persisted. */
  hash: string;
}

/**
 * Mint a registration token.
 *
 * The secret is 256 random bits, so a fast digest is the right hash: a password
 * KDF exists to slow down guessing of low-entropy inputs, and using one here
 * would only add latency to a redemption. What matters is that the digest is all
 * that is stored and that the row is burned atomically when it is spent.
 */
export function generatePairingTokenSecret(): GeneratedPairingTokenSecret {
  const random = randomBytes(SECRET_BYTES).toString('base64url');
  const secret = `${PAIRING_TOKEN_PREFIX}_${random}`;
  return {
    secret,
    prefix: `${PAIRING_TOKEN_PREFIX}_${random.slice(0, DISPLAY_CHARS)}`,
    hash: hashPairingTokenSecret(secret),
  };
}

/** SHA-256 digest of a presented secret, in hex — the lookup key on redemption. */
export function hashPairingTokenSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}
