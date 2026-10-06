/**
 * Seals a secret for storage and opens it again. What the calendar keeps of a
 * Google grant is the refresh token, and it is never stored in the clear.
 */
export interface TokenSealerPort {
  /** Whether a key is configured; without one nothing can be sealed or opened. */
  isConfigured(): boolean;
  seal(plaintext: string): Buffer;
  /** Throws when the bytes were not sealed under the current key. */
  open(sealed: Buffer): string;
}
