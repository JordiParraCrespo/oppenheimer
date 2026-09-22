/**
 * The host's public key, for sealing something to it (F7): an installation
 * token on `credentials.grant` is encrypted so only the runner holding the
 * private half can read it, and the relay never sees it in the clear after
 * minting.
 */
export interface HostKeyPort {
  /** The base64 raw Ed25519 public key of a paired host, or `null`. */
  publicKeyOf(hostId: string): Promise<string | null>;
}
