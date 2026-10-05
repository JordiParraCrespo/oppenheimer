import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AesTokenSealerAdapter } from '../infrastructure/aes-token-sealer.adapter';

const sealerWith = (key: string | undefined) =>
  new AesTokenSealerAdapter({ get: () => key } as unknown as ConfigService);

/**
 * A Google refresh token is the one secret Plan stores. What breaks if this
 * regresses: the token sits in the database in the clear, or a key change
 * opens tokens into garbage instead of refusing them, which is what lets the
 * calendar ask the person to reconnect.
 */
describe('AesTokenSealerAdapter', () => {
  const key = randomBytes(32).toString('base64');

  it('seals so the stored bytes do not contain the token, and opens them again', () => {
    const sealer = sealerWith(key);
    const sealed = sealer.seal('1//refresh-token');
    expect(sealed.includes(Buffer.from('refresh-token'))).toBe(false);
    expect(sealer.open(sealed)).toBe('1//refresh-token');
  });

  it('refuses a token sealed under another key, or tampered with', () => {
    const sealed = sealerWith(key).seal('1//refresh-token');
    expect(() => sealerWith(randomBytes(32).toString('base64')).open(sealed)).toThrow();
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 20] ^= 1;
    expect(() => sealerWith(key).open(tampered)).toThrow();
  });

  it('is off without a key, or with one that is not 32 bytes', () => {
    expect(sealerWith(undefined).isConfigured()).toBe(false);
    expect(sealerWith(Buffer.from('short').toString('base64')).isConfigured()).toBe(false);
    expect(sealerWith(key).isConfigured()).toBe(true);
  });
});
