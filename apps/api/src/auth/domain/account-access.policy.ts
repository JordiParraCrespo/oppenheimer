/** The facts about an account that decide whether it may act at all. */
export interface AccountStanding {
  /** Only an explicit `false` deactivates; the column defaults to `true`. */
  isActive?: boolean | null;
  /** Absent on a record the admin plugin never touched: not banned. */
  banned?: boolean | null;
  /** A `Date`, or an ISO string when it arrives off the wire or a cache. */
  banExpires?: Date | string | null;
}

/**
 * Whether an account may authenticate right now, by any credential: a browser
 * session, an API token, an OAuth grant. Deactivated: never. Banned: not until
 * the ban's expiry, if it has one — the admin plugin lifts an expired ban only
 * when a session is next created, so the rule cannot wait for it.
 *
 * This is the one place the rule is written; the session path in
 * `ApiAuthGuard` and the credential owner lookup both ask it. An expiry that
 * does not parse counts as still banned: failing closed is the only safe
 * reading of a ban nobody can date.
 */
export function isAccessAllowed(account: AccountStanding, now: Date): boolean {
  if (account.isActive === false) return false;
  if (!account.banned) return true;
  if (account.banExpires == null) return false;

  const expires =
    account.banExpires instanceof Date ? account.banExpires : new Date(account.banExpires);
  return Number.isFinite(expires.getTime()) && expires.getTime() <= now.getTime();
}
