import { createHash, createPublicKey, type KeyObject, verify } from 'node:crypto';

/**
 * The Ed25519 half of the host credential, in `node:crypto` alone.
 *
 * A boot assertion is a compact JWS the runner signs with the key it generated
 * at pairing (`apps/runner/internal/pairing/domain/identity.go`), and this file
 * is everything needed to check one: split it, insist the header says `EdDSA`,
 * and verify the signature against the raw 32-byte key the host registered.
 *
 * `alg` is not read to *choose* an algorithm — it is asserted, and the key is
 * always Ed25519 — so the algorithm-confusion family of attacks has nothing to
 * work with here.
 */

/** DER prefix of an Ed25519 SubjectPublicKeyInfo, which wraps the raw 32 bytes. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** Raw Ed25519 public keys are exactly this long. */
const RAW_KEY_BYTES = 32;

export interface HostAssertionClaims {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  jti?: unknown;
  exp?: unknown;
  iat?: unknown;
}

export interface DecodedHostAssertion {
  claims: HostAssertionClaims;
  /** The `header.payload` bytes the signature covers. */
  signingInput: Buffer;
  signature: Buffer;
}

/**
 * Does this bearer value even look like an EdDSA JWS?
 *
 * This is the question the credential resolver asks before handing a bearer to
 * the hosts module: three dot-separated base64url segments whose header decodes
 * to `{"alg":"EdDSA",…}`. Cheap, and wrong only in the direction of asking the
 * verifier about something it will then refuse.
 */
export function looksLikeHostAssertion(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return false;
  return decodeJson(parts[0])?.alg === 'EdDSA';
}

/**
 * Split an assertion into the pieces a verifier needs, or `null` when it is not
 * one at all. Nothing here is trusted: the claims are unverified until the
 * signature is checked.
 */
export function decodeHostAssertion(assertion: string): DecodedHostAssertion | null {
  const parts = assertion.split('.');
  if (parts.length !== 3) return null;

  const header = decodeJson(parts[0]);
  if (header?.alg !== 'EdDSA') return null;
  // `typ` is optional in a JWS, but a compact token that declares one and means
  // something else is not a token this control plane issued a key for.
  if (header.typ !== undefined && header.typ !== 'JWT') return null;

  const claims = decodeJson(parts[1]);
  if (!claims) return null;

  const signature = fromBase64Url(parts[2]);
  if (!signature) return null;

  return {
    claims,
    signingInput: Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii'),
    signature,
  };
}

/**
 * Is this assertion signed by one of these keys?
 *
 * Takes a list because a host may hold two valid keys during a rotation window,
 * and a boot that arrives on either is the same host.
 */
export function assertionIsSignedBy(
  decoded: DecodedHostAssertion,
  base64PublicKeys: readonly string[],
): boolean {
  for (const base64Key of base64PublicKeys) {
    const key = publicKeyFromBase64(base64Key);
    if (!key) continue;
    try {
      if (verify(null, decoded.signingInput, key, decoded.signature)) return true;
    } catch {
      // A key the platform cannot load is a key nothing can be verified
      // against; try the next one rather than failing the whole check.
    }
  }
  return false;
}

/**
 * SHA-256 of the raw public key, as colon-free hex — the fingerprint the runner
 * computes for itself and the form shown beside a host.
 */
export function keyFingerprint(base64PublicKey: string): string | null {
  const raw = rawKeyFromBase64(base64PublicKey);
  if (!raw) return null;
  return createHash('sha256').update(raw).digest('hex');
}

/** Turn the runner's base64 public key into something `verify` accepts. */
export function publicKeyFromBase64(base64PublicKey: string): KeyObject | null {
  const raw = rawKeyFromBase64(base64PublicKey);
  if (!raw) return null;
  try {
    return createPublicKey({
      key: Buffer.concat([SPKI_PREFIX, raw]),
      format: 'der',
      type: 'spki',
    });
  } catch {
    return null;
  }
}

function rawKeyFromBase64(base64PublicKey: string): Buffer | null {
  const raw = fromBase64Url(base64PublicKey);
  if (!raw || raw.length !== RAW_KEY_BYTES) return null;
  return raw;
}

/**
 * Base64 that tolerates both alphabets — the runner sends standard base64 for the
 * public key and base64url inside the token, and both mean the same bytes — and
 * refuses anything that is not base64 at all.
 *
 * The refusal has to be a re-encode, because Node's decoder never throws: it
 * skips characters it does not recognise and returns whatever it managed to
 * read. So `{"alg":"EdDSA"}!!!` decodes happily, and a token with trailing
 * garbage would otherwise verify on the bytes the decoder chose to keep.
 */
function fromBase64Url(value: string): Buffer | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === 0) return null;
  // Unpadded standard base64 is the canonical form of both alphabets here, so a
  // value that does not round-trip to it carried something the decoder dropped.
  if (decoded.toString('base64').replace(/=+$/, '') !== normalized) return null;
  return decoded;
}

function decodeJson(segment: string): Record<string, unknown> | null {
  const raw = fromBase64Url(segment);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
