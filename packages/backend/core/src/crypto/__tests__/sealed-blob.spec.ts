import { createDecipheriv, createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { openBlob, sealBlob } from '../sealed-blob';

/**
 * The sealed layout the calendar's refresh tokens, GitHub user tokens and bot
 * provider keys are stored in. What breaks if this regresses: a stored secret
 * no longer opens after a deploy, or a key change opens one into garbage
 * instead of refusing it.
 */
const KEY = Buffer.alloc(32, 7);

describe('sealBlob / openBlob', () => {
  it('opens what it sealed, without the plaintext in the stored bytes', () => {
    const blob = sealBlob(KEY, '1//refresh-token');
    expect(blob.includes(Buffer.from('refresh-token'))).toBe(false);
    expect(openBlob(KEY, blob)).toBe('1//refresh-token');
  });

  it('writes version ‖ key id ‖ nonce ‖ ciphertext ‖ tag, the layout already stored', () => {
    const blob = sealBlob(KEY, 'secret');
    expect(blob.length).toBe(1 + 4 + 12 + 'secret'.length + 16);
    expect(blob[0]).toBe(1);
    const keyId = createHash('sha256').update(KEY).digest().subarray(0, 4);
    expect(blob.subarray(1, 5).equals(keyId)).toBe(true);
    const decipher = createDecipheriv('aes-256-gcm', KEY, blob.subarray(5, 17));
    decipher.setAuthTag(blob.subarray(blob.length - 16));
    const body = blob.subarray(17, blob.length - 16);
    expect(Buffer.concat([decipher.update(body), decipher.final()]).toString()).toBe('secret');
  });

  it('refuses another key, another version and a tampered blob', () => {
    const blob = sealBlob(KEY, 'secret');
    expect(() => openBlob(Buffer.alloc(32, 8), blob)).toThrow('Sealed under another key');
    const versioned = Buffer.from(blob);
    versioned[0] = 2;
    expect(() => openBlob(KEY, versioned)).toThrow('Unknown sealed-blob version');
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 20] ^= 1;
    expect(() => openBlob(KEY, tampered)).toThrow();
  });
});
