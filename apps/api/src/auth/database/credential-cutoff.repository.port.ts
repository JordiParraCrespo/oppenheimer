/**
 * The moment before which an account's scoped credentials no longer count:
 * its last password reset. Written with the reset's revocation
 * (`OAuthGrantRepositoryPort.revokeAllForUser`); read here.
 */
export interface CredentialCutoffRepositoryPort {
  /** The account's cutoff, or `null` when its password was never reset. */
  findCutoff(userId: string): Promise<Date | null>;
}
