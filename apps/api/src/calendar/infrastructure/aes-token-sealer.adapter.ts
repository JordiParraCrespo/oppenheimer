import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openBlob, sealBlob } from '@oppenheimer/backend-core';
import { calendarTokenKeyOf } from '../../config/calendar.config';
import type { TokenSealerPort } from './token-sealer.port';

/**
 * Google refresh tokens under `CALENDAR_TOKEN_KEY`, in the API's sealed-blob
 * layout (`sealBlob`, `@oppenheimer/backend-core`).
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
    return calendarTokenKeyOf(this.configService.get<string>('calendar.tokenKey'));
  }

  private requireKey(): Buffer {
    const key = this.key;
    if (!key) throw new Error('CALENDAR_TOKEN_KEY is not set');
    return key;
  }
}
