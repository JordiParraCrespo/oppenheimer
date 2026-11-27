/**
 * Whether an account may be issued a credential that outlives its sessions: an
 * API token, an OAuth (MCP) grant, a host pairing token, a routine's webhook
 * URL.
 *
 * Sign-up does not require a verified address, so without this anyone could
 * register `victim@corp.com` first, mint a token, and keep it after the real
 * owner recovered the account through "Forgot password". A session dies with
 * the reset (`revokeSessionsOnPasswordReset`), and so do API tokens and OAuth
 * grants (`CompletePasswordResetCommand`). A paired host and a webhook URL
 * are kept through a reset when they were issued to a verified address, since
 * taking them back would cost a real owner their machines and integrations on
 * every reset; so the address is proven first.
 *
 * Only where the deployment delivers email (the `email_delivery` capability,
 * passed in by the caller). Without it no address can ever be verified, so the
 * rule would lock every account out of tokens, hosts, MCP and webhooks for
 * good. Delivery can be switched on later, though, and an administrator can
 * set a password (`POST /v1/admin/users/{id}/set-password`) with no email at
 * all, so a host or webhook URL issued here records that its owner was not
 * verified (`CredentialIssuance.ownerEmailVerified`), and every reset, an
 * administrator's included, unpairs those hosts and revokes those URLs
 * (`PasswordResetDomainEvent`).
 */
export function mayIssueCredential(
  owner: { emailVerified: boolean | null | undefined },
  deployment: { emailDelivery: boolean },
): boolean {
  if (!deployment.emailDelivery) return true;
  return owner.emailVerified === true;
}
