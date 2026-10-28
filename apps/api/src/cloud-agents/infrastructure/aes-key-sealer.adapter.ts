import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openBlob, sealBlob } from '@oppenheimer/backend-core';
import { cloudAgentsSealKeyOf } from '../../config/cloud-agents.config';
import type { KeySealerPort } from './key-sealer.port';

/**
 * Vendor keys under `CLOUD_AGENTS_KEY`, in the API's sealed-blob layout
 * (`sealBlob`, `@oppenheimer/backend-core`).
 */
@Injectable()
export class AesKeySealerAdapter implements KeySealerPort {
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
    return cloudAgentsSealKeyOf(this.configService.get<string>('cloudAgents.sealKey'));
  }

  private requireKey(): Buffer {
    const key = this.key;
    if (!key) throw new Error('CLOUD_AGENTS_KEY is not set');
    return key;
  }
}
