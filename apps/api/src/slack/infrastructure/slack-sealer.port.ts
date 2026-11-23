/**
 * Seals an app's bot token and signing secret before they are stored, and
 * opens them for the call or the check that needs them. Neither reaches a
 * log or a response.
 */
export interface SlackSealerPort {
  /** Whether a sealing key is configured (`SLACK_TOKEN_KEY`). */
  isConfigured(): boolean;
  seal(plaintext: string): Buffer;
  /** Throws when the bytes were not sealed under the current key. */
  open(sealed: Buffer): string;
}
