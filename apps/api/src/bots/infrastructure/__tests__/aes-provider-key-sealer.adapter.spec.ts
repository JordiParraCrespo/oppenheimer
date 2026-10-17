import type { ConfigService } from '@nestjs/config';
import { AesProviderKeySealerAdapter } from '../aes-provider-key-sealer.adapter';

/**
 * A provider key is stored sealed and comes back whole for the turn that needs
 * it: the round trip, a key sealed under another `BOTS_PROVIDER_KEY` refused
 * rather than read as garbage, and nothing sealed when no key is configured.
 */
const sealerWith = (key: string | undefined) =>
  new AesProviderKeySealerAdapter({
    get: (name: string) => (name === 'bots.providerKey' ? key : undefined),
  } as ConfigService);

const KEY_A = Buffer.alloc(32, 1).toString('base64');
const KEY_B = Buffer.alloc(32, 2).toString('base64');

describe('AesProviderKeySealerAdapter', () => {
  it('opens what it sealed, and never stores the key in the clear', () => {
    const sealer = sealerWith(KEY_A);
    const sealed = sealer.seal('sk-provider-key-1234');
    expect(sealed.includes(Buffer.from('sk-provider-key-1234'))).toBe(false);
    expect(sealer.open(sealed)).toBe('sk-provider-key-1234');
  });

  it('refuses a key sealed under another sealing key', () => {
    const sealed = sealerWith(KEY_A).seal('sk-provider-key-1234');
    expect(() => sealerWith(KEY_B).open(sealed)).toThrow('Sealed under another key');
  });

  it('is not configured, and seals nothing, without a 32-byte key', () => {
    expect(sealerWith(undefined).isConfigured()).toBe(false);
    expect(sealerWith('short').isConfigured()).toBe(false);
    expect(() => sealerWith(undefined).seal('x')).toThrow('BOTS_PROVIDER_KEY is not set');
  });
});
