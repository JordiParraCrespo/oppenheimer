/**
 * The door every credential that outlives a session is issued through: an API
 * token, a host pairing token, a routine's webhook URL. Bound to
 * `CREDENTIAL_ISSUANCE`; the rule is `mayIssueCredential`. (The OAuth grant's
 * door is the Better Auth hook in `oauth-grant-gate.util.ts`, which asks the
 * same rule.)
 */
export interface CredentialIssuancePort {
  /**
   * Resolves when the account may be issued one; otherwise throws
   * `EMAIL_VERIFICATION_REQUIRED` (`TOKEN_010`), or `TOKEN_003` for an owner
   * that is missing, deactivated or banned. The account is read fresh, not
   * from the session cache: a stale "verified" must not mint.
   */
  assertMayIssue(userId: string): Promise<void>;
}
