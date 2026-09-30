import {
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  hkdfSync,
} from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seal } from '../infrastructure/seal.util';

/**
 * The half of the sealing scheme the control plane runs. The runner's test
 * opens a frozen vector this code produced for the seed below; this one opens
 * what the code produces now, the way the runner does, so a change to the map,
 * the salt or the info string cannot pass both suites.
 */
const SEED = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
const PKCS8_X25519 = Buffer.from('302e020100300506032b656e04220420', 'hex');
const SPKI_X25519 = Buffer.from('302a300506032b656e032100', 'hex');
/** The runner's `SealInfo`, written out: importing ours would agree with any change to it. */
const RUNNER_SEAL_INFO = 'oppenheimer credentials.grant v1';

function vectorKey() {
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519, SEED]),
    format: 'der',
    type: 'pkcs8',
  });
  return createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
}

/** The runner's `Unseal`: the host's X25519 scalar is SHA-512 of its Ed25519 seed. */
function open(sealed: Buffer, hostEdPublic: Buffer): Buffer {
  const ephemeral = sealed.subarray(0, 32);
  const nonce = sealed.subarray(32, 44);
  const tag = sealed.subarray(-16);
  const shared = diffieHellman({
    privateKey: createPrivateKey({
      key: Buffer.concat([
        PKCS8_X25519,
        createHash('sha512').update(SEED).digest().subarray(0, 32),
      ]),
      format: 'der',
      type: 'pkcs8',
    }),
    publicKey: createPublicKey({
      key: Buffer.concat([SPKI_X25519, ephemeral]),
      format: 'der',
      type: 'spki',
    }),
  });
  const key = Buffer.from(
    hkdfSync('sha256', shared, Buffer.concat([ephemeral, hostEdPublic]), RUNNER_SEAL_INFO, 32),
  );
  const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed.subarray(44, -16)), decipher.final()]);
}

describe('seal', () => {
  it('seals a box the host key opens: ephemeral, nonce, box, tag', () => {
    const publicKey = vectorKey();
    expect(publicKey.toString('hex')).toBe(
      '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664',
    );
    const plaintext = 'ghs_example_token_0123456789';
    const sealed = seal(publicKey.toString('base64'), Buffer.from(plaintext));
    expect(sealed.byteLength).toBe(32 + 12 + plaintext.length + 16);
    expect(open(sealed, publicKey).toString()).toBe(plaintext);
  });

  it('seals differently every time, so a captured box is worthless later', () => {
    const publicKey = vectorKey().toString('base64');
    const a = seal(publicKey, Buffer.from('x'));
    const b = seal(publicKey, Buffer.from('x'));
    expect(a.equals(b)).toBe(false);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => seal(Buffer.from('short').toString('base64'), Buffer.from('x'))).toThrow(
      RangeError,
    );
  });
});
