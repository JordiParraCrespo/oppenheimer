/**
 * Whose a host is: the account its runner was paired with. The runner names
 * the top level of its work folder by it (`product/versions/mvp/24-session-places.md`
 * §2), so every command that tells a host where to put work carries it.
 */
export interface HostOwnerPort {
  /**
   * The id of the person who paired the host, paired or not, read with no
   * access scope: the caller is building a command for a host it already
   * checked, or one the host's own link asked for. Null for no such host.
   */
  ownerOf(hostId: string): Promise<string | null>;
}
