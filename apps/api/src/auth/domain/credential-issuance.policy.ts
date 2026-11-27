/**
 * Whether an account may be issued a credential that outlives its sessions: an
 * API token, an OAuth (MCP) grant, a host pairing token, a routine's webhook
 * URL.
 *
 * Sign-up does not require a verified address, so without this anyone could
 * register `victim@corp.com` first, mint a token, and keep it after the real
 * owner recovered the account through "Forgot password". A session dies with
 * the reset (`revokeSessionsOnPasswordReset`), and so do API tokens and OAuth
 * grants (`CompletePasswordResetCommand`); a paired host and a webhook URL do
 * not, because taking them back would cost a real owner their machines and
 * integrations on every reset. So the address is proven first.
 *
 * Only where the deployment delivers email (the `email_delivery` capability,
 * passed in by the caller). Without it no address can ever be verified, so the
 * rule would lock every account out of tokens, hosts, MCP and webhooks for
 * good; and there is no "Forgot password" email either, so the squat it stops
 * cannot be completed.
 */
export function mayIssueCredential(
  owner: { emailVerified: boolean | null | undefined },
  deployment: { emailDelivery: boolean },
): boolean {
  if (!deployment.emailDelivery) return true;
  return owner.emailVerified === true;
}
