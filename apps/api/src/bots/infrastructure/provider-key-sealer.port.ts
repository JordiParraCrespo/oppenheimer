/**
 * Seals a workspace's model provider key before it is stored, and opens it for
 * the worker that runs a turn. The key never reaches a log or a response.
 */
export interface ProviderKeySealerPort {
  /** Whether a sealing key is configured (`BOTS_PROVIDER_KEY`). */
  isConfigured(): boolean;
  seal(plaintext: string): Buffer;
  open(sealed: Buffer): string;
}
