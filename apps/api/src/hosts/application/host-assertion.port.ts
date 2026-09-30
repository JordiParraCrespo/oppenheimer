/**
 * What a verified host credential amounts to: the machine that signed it and
 * how long the assertion it signed is good for. A host is not a person — it has
 * no roles, no scopes and no ability.
 */
export interface HostPrincipalIdentity {
  hostId: string;
  /** The assertion's own expiry, so a caller can bound what it caches. */
  expiresAt: Date;
  /**
   * Whether that host has been unpaired. Not a refusal: an unpaired host still
   * authenticates, because its own uninstall has to. It is read off the row the
   * verification already loaded, so a caller that must refuse one — the link
   * handshake — asks nothing else.
   */
  unpaired: boolean;
}

/**
 * Verifies the boot assertion a runner presents as an ordinary
 * `Authorization: Bearer`, on the `/hosts/self` routes and on the runner link's
 * WebSocket handshake (`product/versions/mvp/03-control-plane.md`).
 *
 * **Identity only**: "which host signed this", with every accepted `jti` burned for
 * the token's remaining lifetime so an assertion cannot be replayed. What the host
 * may then do is `HostAccessPort`'s question, which is why an unpaired host still
 * authenticates: its uninstall call must be able to say so twice and get one answer.
 *
 * The one standing it checks is the owner's: a host acts for the person who paired
 * it, so a banned or deactivated owner (`isAccessAllowed`) takes its credential down
 * with every other one they hold, uninstall included.
 */
export interface HostAssertionPort {
  /**
   * Is this bearer value a host assertion at all?
   *
   * The credential resolver asks before handing anything over, so "what shape a
   * host credential has" stays knowledge of this module rather than a second
   * copy in the auth layer. It is a shape test, not a verification: a `true`
   * only means {@link verify} is the right question to ask next.
   */
  recognises(bearer: string): boolean;

  /**
   * Resolve the host an assertion names, or throw the module's opaque rejection.
   * A refusal never says which check failed: the signature, the audience, the
   * expiry and the replay guard share one answer so the endpoint cannot be used
   * to probe any of them.
   */
  verify(assertion: string): Promise<HostPrincipalIdentity>;
}
