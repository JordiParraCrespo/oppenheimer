/**
 * Whether the GitHub account that authorized an install controls the account
 * the installation is on. Seeing an installation proves nothing on its own:
 * GitHub lists one for anyone with explicit access to a single repository it
 * covers, so a collaborator could otherwise claim the whole installation, its
 * write tokens and its webhooks, and lock its owner out with `GITHUB_003`.
 *
 * Each function answers why the claim is refused, or null when it holds.
 */

/** The account an installation is on, as GitHub reports it. */
export interface InstalledAccount {
  accountId: number;
  accountLogin: string;
}

/** The authorizing person's membership of the organization, as GitHub reports it. */
export interface OwnerStanding {
  active: boolean;
  admin: boolean;
}

/** A personal installation is claimed only by that person. */
export function personalClaimRefusal(
  account: InstalledAccount,
  authorizingGithubUserId: number,
): string | null {
  if (account.accountId === authorizingGithubUserId) return null;
  return `This installation is on ${account.accountLogin}'s personal account; only ${account.accountLogin} can connect it.`;
}

/**
 * An organization's installation is claimed only by an active owner (`admin`)
 * of it. GitHub not answering (null) fails closed: it is either no membership
 * or the App without the Members: read permission, and neither proves ownership.
 */
export function organizationClaimRefusal(
  account: InstalledAccount,
  standing: OwnerStanding | null,
): string | null {
  if (!standing) {
    return `GitHub would not say whether you own ${account.accountLogin}: you are not a member, or the App lacks the Members: read organization permission.`;
  }
  if (standing.active && standing.admin) return null;
  return `Only an owner of ${account.accountLogin} can connect its installation.`;
}
