import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { botsProviderKeyOf } from '../../config/bots.config';
import type { ProviderKeySealerPort } from './provider-key-sealer.port';

const VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID_BYTES = 4;

/**
 * AES-256-GCM under `BOTS_PROVIDER_KEY`, the calendar's sealed-token layout:
 * `version (1) ‖ key id (4) ‖ nonce (12) ‖ ciphertext ‖ tag (16)`, the key id
 * being the first four bytes of the key's SHA-256, so a key sealed under a key
 * since replaced is told apart from a corrupt one.
 */
@Injectable()
export class AesProviderKeySealerAdapter implements ProviderKeySealerPort {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return this.key !== null;
  }

  seal(plaintext: string): Buffer {
    const key = this.requireKey();
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), keyIdOf(key), nonce, body, cipher.getAuthTag()]);
  }

  open(sealed: Buffer): string {
    const key = this.requireKey();
    if (sealed[0] !== VERSION) throw new Error('Unknown sealed-key version');
    const keyId = sealed.subarray(1, 1 + KEY_ID_BYTES);
    if (!keyId.equals(keyIdOf(key))) throw new Error('Sealed under another key');
    const nonce = sealed.subarray(1 + KEY_ID_BYTES, 1 + KEY_ID_BYTES + NONCE_BYTES);
    const tag = sealed.subarray(sealed.length - TAG_BYTES);
    const body = sealed.subarray(1 + KEY_ID_BYTES + NONCE_BYTES, sealed.length - TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
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

function keyIdOf(key: Buffer): Buffer {
  return createHash('sha256').update(key).digest().subarray(0, KEY_ID_BYTES);
}
