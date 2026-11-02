/**
 * Seals a person's vendor key before it is stored, and opens it for the call
 * that needs it. The key never reaches a log or a response.
 */
export interface KeySealerPort {
  /** Whether a sealing key is configured (`CLOUD_AGENTS_KEY`). */
  isConfigured(): boolean;
  seal(plaintext: string): Buffer;
  /** Throws when the bytes were not sealed under the current key. */
  open(sealed: Buffer): string;
}
