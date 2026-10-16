import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { openBlob, sealBlob } from '@oppenheimer/backend-core';
import { githubUserTokenKeyOf } from '../../config/github.config';
import type { UserTokenSealerPort } from './user-token-sealer.port';

/**
 * GitHub user tokens under `GITHUB_USER_TOKEN_KEY`, in the API's sealed-blob
 * layout (`sealBlob`, `@oppenheimer/backend-core`): a token sealed under a key
 * since replaced reads as "connect again" rather than as corruption.
 */
@Injectable()
export class AesUserTokenSealerAdapter implements UserTokenSealerPort {
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
    return githubUserTokenKeyOf(this.configService.get<string>('githubApp.userTokenKey'));
  }

  private requireKey(): Buffer {
    const key = this.key;
    if (!key) throw new Error('GITHUB_USER_TOKEN_KEY is not set');
    return key;
  }
}
