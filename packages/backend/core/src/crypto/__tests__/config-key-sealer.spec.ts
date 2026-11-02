import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import {
  ConfigKeySealer,
  type ConfigKeySealerOptions,
  configKeySealer,
} from '../config-key-sealer';

/**
 * The one sealer every module that stores a secret binds to its own token
 * (calendar and Gmail refresh tokens, GitHub user tokens, bot provider keys,
 * cloud-agent keys). What breaks if this regresses: a secret already stored no
 * longer opens after a deploy, a key change opens one into garbage instead of
 * refusing it, or a module with no key set fails its boot rather than turning
 * the feature off.
 */
const keyOf = (value: string | undefined): Buffer | null => {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
};

const OPTIONS: ConfigKeySealerOptions = {
  configKey: 'calendar.tokenKey',
  envName: 'CALENDAR_TOKEN_KEY',
  keyOf,
};

const sealerWith = (key: string | undefined, options = OPTIONS) =>
  new ConfigKeySealer(
    { get: (name: string) => (name === options.configKey ? key : undefined) } as ConfigService,
    options,
  );

describe('ConfigKeySealer', () => {
  const key = randomBytes(32).toString('base64');

  it('seals so the stored bytes do not contain the secret, and opens them again', () => {
    const sealer = sealerWith(key);
    const sealed = sealer.seal('1//refresh-token');
    expect(sealed.includes(Buffer.from('refresh-token'))).toBe(false);
    expect(sealer.open(sealed)).toBe('1//refresh-token');
  });

  it('opens what the per-module sealers it replaced stored', () => {
    // Sealed by the calendar's and the bots' own adapters before they became
    // this one, under a key of 32 bytes of 7: stored rows must still open.
    const legacyKey = Buffer.alloc(32, 7).toString('base64');
    const fromCalendar = Buffer.from(
      'AUuwb476dRVM+8l6RXIZe8/QSBaUN3hAjscPi+pk8HFmaqDoJe7tL3DWrq5m2IPl/g==',
      'base64',
    );
    const fromBots = Buffer.from(
      'AUuwb47e2KhgzGaMHoLZnCzSIGScDl7hBwV68NvTWtnUWXlnEHV7zfdstQcQ9sjUaX2ahhY=',
      'base64',
    );
    expect(sealerWith(legacyKey).open(fromCalendar)).toBe('1//refresh-token');
    const bots = { configKey: 'bots.providerKey', envName: 'BOTS_PROVIDER_KEY', keyOf };
    expect(sealerWith(legacyKey, bots).open(fromBots)).toBe('sk-provider-key-1234');
  });

  it('refuses a secret sealed under another key, or tampered with', () => {
    const sealed = sealerWith(key).seal('1//refresh-token');
    expect(() => sealerWith(randomBytes(32).toString('base64')).open(sealed)).toThrow(
      'Sealed under another key',
    );
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 20] ^= 1;
    expect(() => sealerWith(key).open(tampered)).toThrow();
  });

  it('is off without a 32-byte key, and seals nothing, naming the variable to set', () => {
    expect(sealerWith(undefined).isConfigured()).toBe(false);
    expect(sealerWith(Buffer.from('short').toString('base64')).isConfigured()).toBe(false);
    expect(sealerWith(key).isConfigured()).toBe(true);
    expect(() => sealerWith(undefined).seal('x')).toThrow('CALENDAR_TOKEN_KEY is not set');
    expect(() => sealerWith(undefined).open(Buffer.alloc(40))).toThrow(
      'CALENDAR_TOKEN_KEY is not set',
    );
  });

  it('binds a module token to a sealer over the ConfigService it is given', () => {
    const TOKEN = Symbol('TOKEN_SEALER');
    const provider = configKeySealer(TOKEN, OPTIONS);
    const config = { get: () => key } as unknown as ConfigService;
    const sealer = provider.useFactory(config) as ConfigKeySealer;
    expect(provider.provide).toBe(TOKEN);
    expect(sealer.open(sealer.seal('secret'))).toBe('secret');
  });
});
