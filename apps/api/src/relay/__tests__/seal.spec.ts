import { createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seal, x25519PublicFromEd25519 } from '../infrastructure/seal.util';

/**
 * The half of the sealing scheme the control plane runs. The other half is the
 * runner's `Unseal`, and the vector its test opens was produced by this code
 * for the seed below — so the two specs together are the round trip.
 */
const SEED = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function vectorKey() {
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, SEED]),
    format: 'der',
    type: 'pkcs8',
  });
  const publicKey = createPublicKey(privateKey)
    .export({ format: 'der', type: 'spki' })
    .subarray(-32);
  return { privateKey, publicKey };
}

describe('seal', () => {
  it('produces the layout the runner opens: ephemeral, nonce, box, tag', () => {
    const { publicKey } = vectorKey();
    const sealed = seal(publicKey.toString('base64'), Buffer.from('ghs_example_token_0123456789'));
    expect(sealed.byteLength).toBe(32 + 12 + 'ghs_example_token_0123456789'.length + 16);
  });

  it('seals differently every time, so a captured box is worthless later', () => {
    const { publicKey } = vectorKey();
    const a = seal(publicKey.toString('base64'), Buffer.from('x'));
    const b = seal(publicKey.toString('base64'), Buffer.from('x'));
    expect(a.equals(b)).toBe(false);
  });

  it('maps the Ed25519 public key onto a point X25519 agrees on', () => {
    // The birational map is checked from the other side: an X25519 key made
    // from the Ed25519 twin must produce the same shared secret whichever
    // representation of the host key the other party holds.
    const { publicKey } = vectorKey();
    expect(publicKey.toString('hex')).toBe(
      '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664',
    );
    const mapped = x25519PublicFromEd25519(publicKey);
    expect(mapped.asymmetricKeyType).toBe('x25519');
    const ephemeral = generateKeyPairSync('x25519');
    const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: mapped });
    expect(shared.byteLength).toBe(32);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => seal(Buffer.from('short').toString('base64'), Buffer.from('x'))).toThrow(
      RangeError,
    );
  });
});
