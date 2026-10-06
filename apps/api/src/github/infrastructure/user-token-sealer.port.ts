/**
 * Seals a person's GitHub user token for storage and opens it again. The token
 * is what lets the Pull requests area act in their name, so it is never stored
 * in the clear.
 */
export interface UserTokenSealerPort {
  /** Whether a key is configured; without one nothing can be sealed or opened. */
  isConfigured(): boolean;
  seal(plaintext: string): Buffer;
  /** Throws when the bytes were not sealed under the current key. */
  open(sealed: Buffer): string;
}
