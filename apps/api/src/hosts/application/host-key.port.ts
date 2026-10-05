/**
 * The host's public key, for sealing something to it (F7): an installation
 * token on `credentials.grant` is encrypted so only the runner holding the
 * private half can read it, and the relay never sees it in the clear after
 * minting.
 */
export interface HostKeyPort {
  /** The base64 raw Ed25519 public key of a paired host, or `null`. */
  publicKeyOf(hostId: string): Promise<string | null>;
  /**
   * `plaintext` sealed to a paired host's key, base64, or `null` when the host
   * has no key. Only the runner holding the private half can open it.
   */
  sealFor(hostId: string, plaintext: Uint8Array): Promise<string | null>;
}
