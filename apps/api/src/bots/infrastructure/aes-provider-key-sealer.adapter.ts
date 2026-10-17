import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openBlob, sealBlob } from '@oppenheimer/backend-core';
import { botsProviderKeyOf } from '../../config/bots.config';
import type { ProviderKeySealerPort } from './provider-key-sealer.port';

/**
 * Model provider keys under `BOTS_PROVIDER_KEY`, in the API's sealed-blob
 * layout (`sealBlob`, `@oppenheimer/backend-core`).
 */
@Injectable()
export class AesProviderKeySealerAdapter implements ProviderKeySealerPort {
  constructor(private readonly configService: ConfigService) {}

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
    return botsProviderKeyOf(this.configService.get<string>('bots.providerKey'));
  }

  private requireKey(): Buffer {
    const key = this.key;
    if (!key) throw new Error('BOTS_PROVIDER_KEY is not set');
    return key;
  }
}
