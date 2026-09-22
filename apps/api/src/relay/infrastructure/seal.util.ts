import {
  createCipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  type KeyObject,
  randomBytes,
} from 'node:crypto';

/**
 * Sealing to a host's Ed25519 key (F7): the installation token on
 * `credentials.grant` is readable by the runner holding the private half and
 * by nothing on the way.
 *
 * The scheme, which `apps/runner/internal/pairing/adapters/token/seal.go` is
 * the other half of:
 *
 * 1. the host's Ed25519 public key is mapped to its X25519 twin
 *    (`u = (1 + y) / (1 - y) mod p`, the birational map between the curves);
 * 2. an ephemeral X25519 key pair is made per seal, and the shared secret is
 *    `X25519(ephemeral private, host public)`;
 * 3. the AEAD key is `HKDF-SHA256(shared, salt = ephemeral public ‖ host
 *    Ed25519 public, info = SEAL_INFO)`, 32 bytes;
 * 4. the plaintext is AES-256-GCM under that key with a fresh 12-byte nonce.
 *
 * The sealed bytes are `ephemeral public (32) ‖ nonce (12) ‖ ciphertext ‖ tag
 * (16)`. Binding the host's key into the salt is what stops a sealed box
 * being re-addressed. Nothing here is a signature: the link the grant rides is
 * already authenticated per host, so the only property needed is that a relay
 * log, a proxy or a second host cannot read the token.
 */
export const SEAL_INFO = 'oppenheimer credentials.grant v1';

const EPHEMERAL_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/** SPKI DER prefix for a raw X25519 public key. */
const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');

/** 2^255 - 19 */
const P = (1n << 255n) - 19n;

export function seal(base64Ed25519PublicKey: string, plaintext: Uint8Array): Buffer {
  const hostEdPublic = Buffer.from(base64Ed25519PublicKey, 'base64');
  if (hostEdPublic.byteLength !== 32) throw new RangeError('an Ed25519 public key is 32 bytes');
  const hostX25519 = x25519PublicFromEd25519(hostEdPublic);

  const ephemeral = generateKeyPairSync('x25519');
  const ephemeralPublic = ephemeral.publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-EPHEMERAL_BYTES);
  const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: hostX25519 });
  const key = Buffer.from(
    hkdfSync('sha256', shared, Buffer.concat([ephemeralPublic, hostEdPublic]), SEAL_INFO, 32),
  );

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([ephemeralPublic, nonce, ciphertext, cipher.getAuthTag()]);
}

/** The Edwards → Montgomery map, on the public key's encoded `y`. */
export function x25519PublicFromEd25519(edPublic: Buffer): KeyObject {
  const encoded = Buffer.from(edPublic);
  // The top bit of the last byte is the sign of x; y is the rest, little-endian.
  encoded[31] &= 0x7f;
  const y = bytesToBigIntLE(encoded);
  if (y >= P) throw new RangeError('not a canonical Ed25519 public key');
  const u = mod((1n + y) * modInverse(mod(1n - y), P));
  return createPublicKey({
    key: Buffer.concat([X25519_SPKI_PREFIX, bigIntToBytesLE(u, 32)]),
    format: 'der',
    type: 'spki',
  });
}

function mod(value: bigint): bigint {
  const r = value % P;
  return r < 0n ? r + P : r;
}

function modInverse(value: bigint, modulus: bigint): bigint {
  // Extended Euclid; `value` is never 0 for a valid key (y = 1 is not on the curve's prime-order subgroup).
  let [a, m, x0, x1] = [mod(value), modulus, 0n, 1n];
  if (a === 0n) throw new RangeError('no inverse');
  while (a > 1n) {
    const q = a / m;
    [a, m] = [m, a % m];
    [x0, x1] = [x1 - q * x0, x0];
  }
  return x1 < 0n ? x1 + modulus : x1;
}

function bytesToBigIntLE(bytes: Buffer): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[i]);
  return value;
}

function bigIntToBytesLE(value: bigint, length: number): Buffer {
  const out = Buffer.alloc(length);
  let v = value;
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
