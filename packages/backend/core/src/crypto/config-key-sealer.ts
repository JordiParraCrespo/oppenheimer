import type { FactoryProvider, InjectionToken } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openBlob, sealBlob } from './sealed-blob';

/** Seals a secret for storage and opens it again; what a module's sealer port promises. */
export interface KeySealer {
  /** Whether a key is configured; without one nothing can be sealed or opened. */
  isConfigured(): boolean;
  seal(plaintext: string): Buffer;
  /** Throws when the bytes were not sealed under the current key. */
  open(sealed: Buffer): string;
}

export interface ConfigKeySealerOptions {
  /** The config path the key is read from, e.g. `mail.tokenKey`. */
  configKey: string;
  /** The variable that sets it, named in the error when it is missing. */
  envName: string;
  /** The config section's parser: the 32-byte key, or `null` when there is none. */
  keyOf: (value: string | undefined) => Buffer | null;
}

/**
 * Secrets under one config key, in the API's sealed-blob layout
 * ({@link sealBlob}). The key is read on every call, so a module whose key is
 * unset boots and answers `isConfigured() === false`.
 */
export class ConfigKeySealer implements KeySealer {
  constructor(
    private readonly configService: ConfigService,
    private readonly options: ConfigKeySealerOptions,
  ) {}

  isConfigured(): boolean {
    return this.key !== null;
  }

  seal(plaintext: string): Buffer {
    return sealBlob(this.requireKey(), plaintext);
  }

  open(sealed: Buffer): string {
    return openBlob(this.requireKey(), sealed);
  }

  private get key(): Buffer | null {
    return this.options.keyOf(this.configService.get<string>(this.options.configKey));
  }

  private requireKey(): Buffer {
    const key = this.key;
    if (!key) throw new Error(`${this.options.envName} is not set`);
    return key;
  }
}

/**
 * Binds a module's own sealer token to a {@link ConfigKeySealer} over its key:
 * `configKeySealer(TOKEN_SEALER, { configKey: 'calendar.tokenKey', … })`.
 */
export function configKeySealer(
  provide: InjectionToken,
  options: ConfigKeySealerOptions,
): FactoryProvider<KeySealer> {
  return {
    provide,
    useFactory: (configService: ConfigService) => new ConfigKeySealer(configService, options),
    inject: [ConfigService],
  };
}
