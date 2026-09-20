import { createHash, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertionIsSignedBy,
  type DecodedHostAssertion,
  decodeHostAssertion,
  keyFingerprint,
  looksLikeHostAssertion,
} from '../host-assertion.util';

/**
 * The Ed25519 arithmetic, checked against keys generated here rather than
 * fixtures — the point of the exercise is that a key the *runner* could have
 * generated verifies, and `node:crypto` is what both sides use.
 */

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
  return { privateKey, base64: raw.toString('base64'), raw };
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Decodes, insisting it worked — every token in these cases is one we built. */
function decoded(token: string): DecodedHostAssertion {
  const parsed = decodeHostAssertion(token);
  if (!parsed) throw new Error(`could not decode ${token}`);
  return parsed;
}

/** A compact JWS, signed the way the runner signs one. */
function assertion(privateKey: KeyObject, claims: Record<string, unknown>, alg = 'EdDSA') {
  const header = base64url(JSON.stringify({ alg, typ: 'JWT' }));
  const payload = base64url(JSON.stringify(claims));
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${base64url(signature)}`;
}

describe('looksLikeHostAssertion', () => {
  it('recognises a compact EdDSA token', () => {
    const { privateKey } = keypair();
    expect(looksLikeHostAssertion(assertion(privateKey, { sub: 'host-1' }))).toBe(true);
  });

  it('does not claim an API token or a session token', () => {
    // This predicate is what routes a bearer to the hosts module, so a false
    // positive would hijack a credential that belongs to another path.
    expect(looksLikeHostAssertion('oppenheimer_pat_abc123')).toBe(false);
    expect(looksLikeHostAssertion('a.b')).toBe(false);
    expect(looksLikeHostAssertion('')).toBe(false);
  });

  it('does not claim an RS256 token', () => {
    const { privateKey } = keypair();
    // Signed with an Ed25519 key but *declaring* RS256: the header is the only
    // thing read here, and this module only ever verifies Ed25519.
    expect(looksLikeHostAssertion(assertion(privateKey, { sub: 'h' }, 'RS256'))).toBe(false);
  });
});

describe('decodeHostAssertion', () => {
  it('returns the claims and the bytes the signature covers', () => {
    const { privateKey } = keypair();
    const token = assertion(privateKey, { sub: 'host-1', jti: 'abc' });

    const parsed = decoded(token);

    expect(parsed.claims).toMatchObject({ sub: 'host-1', jti: 'abc' });
    expect(parsed.signingInput.toString()).toBe(token.split('.').slice(0, 2).join('.'));
  });

  it('refuses a token whose `typ` is something else', () => {
    const { privateKey } = keypair();
    const header = base64url(JSON.stringify({ alg: 'EdDSA', typ: 'dpop+jwt' }));
    const payload = base64url(JSON.stringify({ sub: 'host-1' }));
    const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey);

    expect(decodeHostAssertion(`${header}.${payload}.${base64url(signature)}`)).toBeNull();
  });

  it('refuses anything that is not three segments of base64url JSON', () => {
    expect(decodeHostAssertion('not.a.token')).toBeNull();
    expect(decodeHostAssertion('only.two')).toBeNull();
  });

  it('refuses a segment with trailing garbage rather than decoding what it can', () => {
    // Node's base64 decoder skips what it does not recognise and returns the
    // rest, so without a re-encode check a token could verify on bytes the
    // decoder chose out of a longer string.
    const { privateKey } = keypair();
    const [header, payload, signature] = assertion(privateKey, { sub: 'host-1' }).split('.');

    expect(decodeHostAssertion(`${header}!!!.${payload}.${signature}`)).toBeNull();
    expect(decodeHostAssertion(`${header}.${payload}.${signature}~~`)).toBeNull();
  });
});

describe('assertionIsSignedBy', () => {
  it('accepts the key that signed it', () => {
    const host = keypair();
    expect(
      assertionIsSignedBy(decoded(assertion(host.privateKey, { sub: 'host-1' })), [host.base64]),
    ).toBe(true);
  });

  it('refuses another host’s key', () => {
    const host = keypair();
    const stranger = keypair();
    expect(
      assertionIsSignedBy(decoded(assertion(host.privateKey, { sub: 'host-1' })), [
        stranger.base64,
      ]),
    ).toBe(false);
  });

  it('accepts a match anywhere in the list, and survives an unusable key', () => {
    // The list is how a rotation window is expressed, and a key the platform
    // cannot load must not stop the other one being tried.
    const host = keypair();
    expect(
      assertionIsSignedBy(decoded(assertion(host.privateKey, { sub: 'host-1' })), [
        'not-a-key',
        host.base64,
      ]),
    ).toBe(true);
  });

  it('refuses a tampered payload', () => {
    const host = keypair();
    const token = assertion(host.privateKey, { sub: 'host-1' });
    const [header, , signature] = token.split('.');
    const forged = `${header}.${base64url(JSON.stringify({ sub: 'host-2' }))}.${signature}`;

    expect(assertionIsSignedBy(decoded(forged), [host.base64])).toBe(false);
  });
});

describe('keyFingerprint', () => {
  it('is the SHA-256 of the raw key, as the runner computes it', () => {
    const host = keypair();

    expect(keyFingerprint(host.base64)).toBe(createHash('sha256').update(host.raw).digest('hex'));
  });

  it('refuses anything that is not 32 bytes', () => {
    expect(keyFingerprint(Buffer.alloc(31).toString('base64'))).toBeNull();
    expect(keyFingerprint('')).toBeNull();
  });

  it('refuses a key that is not base64 at all', () => {
    expect(keyFingerprint('this is not a key, it is a sentence!!')).toBeNull();
  });
});
