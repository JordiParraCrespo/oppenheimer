import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 1;
const KEY_ID_BYTES = 4;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + KEY_ID_BYTES + NONCE_BYTES;

/**
 * A secret the API stores at rest (a refresh token, a provider key), sealed
 * with AES-256-GCM under a 32-byte key from config:
 *
 * `version (1) ‖ key id (4) ‖ nonce (12) ‖ ciphertext ‖ tag (16)`
 *
 * The key id is the first four bytes of the key's SHA-256, so a blob sealed
 * under a key since replaced is told apart from a corrupt one, and a rotation
 * can be written later without guessing which key sealed what. Blobs already
 * stored are in this layout: changing it is a new version, never an edit.
 */
export function sealBlob(key: Buffer, plaintext: string): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), keyIdOf(key), nonce, body, cipher.getAuthTag()]);
}

/** The plaintext {@link sealBlob} sealed under `key`; throws for another key, another version or a tampered blob. */
export function openBlob(key: Buffer, blob: Buffer): string {
  if (blob[0] !== VERSION) throw new Error('Unknown sealed-blob version');
  if (!blob.subarray(1, 1 + KEY_ID_BYTES).equals(keyIdOf(key))) {
    throw new Error('Sealed under another key');
  }
  const nonce = blob.subarray(1 + KEY_ID_BYTES, HEADER_BYTES);
  const body = blob.subarray(HEADER_BYTES, blob.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(blob.subarray(blob.length - TAG_BYTES));
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

function keyIdOf(key: Buffer): Buffer {
  return createHash('sha256').update(key).digest().subarray(0, KEY_ID_BYTES);
}
