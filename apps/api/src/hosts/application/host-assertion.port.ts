/**
 * What a verified host credential amounts to: the machine that signed it and
 * how long the assertion it signed is good for. A host is not a person — it has
 * no roles, no scopes and no ability.
 */
export interface HostPrincipalIdentity {
  hostId: string;
  /** The assertion's own expiry, so a caller can bound what it caches. */
  expiresAt: Date;
}

/**
 * Verifies the boot assertion a runner presents as an ordinary
 * `Authorization: Bearer` — on `DELETE /hosts/self` today, and on the relay's
 * WebSocket handshake when that arrives
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * This is **identity only**. It answers "which host signed this", and every
 * `jti` it accepts is burned for the token's remaining lifetime so the same
 * assertion cannot be replayed. What that host is then allowed to do is a
 * separate question, and `HostAccessPort` is where it is asked — which is why an
 * unpaired host can still authenticate: its own uninstall call must be able to
 * say so twice and get the same answer.
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
