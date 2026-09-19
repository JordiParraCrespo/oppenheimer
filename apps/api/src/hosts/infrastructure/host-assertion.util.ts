import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
  verify,
} from 'node:crypto';

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

/**
 * The public fingerprint of this control plane's own signing key, which a runner
 * pins at registration and refuses to talk to anything else by (F6).
 *
 * The key is configured as the base64 of its PKCS#8 DER — one line, no PEM
 * header. Returns `null` for anything that is not an Ed25519 private key, so a
 * misconfigured deployment reports "not configured" rather than handing out a
 * fingerprint of the wrong thing.
 */
export function signingKeyFingerprint(base64PrivateKey: string): string | null {
  let der: Buffer;
  try {
    der = Buffer.from(base64PrivateKey.replace(/\s+/g, ''), 'base64');
  } catch {
    return null;
  }
  try {
    const privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    if (privateKey.asymmetricKeyType !== 'ed25519') return null;
    const publicKey = createPublicKey(privateKey);
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(SPKI_PREFIX.length);
    return createHash('sha256').update(raw).digest('hex');
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
 * Base64 that tolerates both alphabets: the runner sends standard base64 for the
 * public key and base64url inside the token, and both mean the same bytes.
 */
function fromBase64Url(value: string): Buffer | null {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = Buffer.from(normalized, 'base64');
  // Node's decoder never throws, it truncates — so a value that does not
  // re-encode to what arrived was not base64 in the first place.
  if (decoded.length === 0) return null;
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
