import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openBlob, sealBlob } from '@oppenheimer/backend-core';
import { mailTokenKeyOf } from '../../config/mail.config';
import type { TokenSealerPort } from './token-sealer.port';

/**
 * Gmail refresh tokens under `MAIL_TOKEN_KEY`, in the API's sealed-blob layout
 * (`sealBlob`, `@oppenheimer/backend-core`): the calendar's sealer under a key
 * of mail's own, so rotating one never disconnects the other.
 */
@Injectable()
export class AesTokenSealerAdapter implements TokenSealerPort {
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
    return mailTokenKeyOf(this.configService.get<string>('mail.tokenKey'));
  }

  private requireKey(): Buffer {
    const key = this.key;
    if (!key) throw new Error('MAIL_TOKEN_KEY is not set');
    return key;
  }
}
