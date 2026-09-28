/** The admin plugin's endpoints that change whether an account may act. */
const STANDING_PATHS = new Set(['/admin/ban-user', '/admin/unban-user']);

/** What a Better Auth after-hook sees of the call it follows. */
export interface AfterHookCall {
  path?: string;
  body?: unknown;
  /** The endpoint's answer, or the `APIError` it refused with. */
  returned?: unknown;
}

/**
 * The account a successful ban or unban changed, or `null` for any other
 * call — including a ban the plugin refused (not an admin, no such user),
 * whose answer is an error rather than a result.
 *
 * `AdminService.ban`/`.unban` rotate the account's delegated sessions
 * themselves, but a ban made straight through `/api/auth/admin/ban-user`
 * never reaches them; the after-hook reads this and raises the rotation for
 * both paths (a second rotation is harmless).
 */
export function standingChangeOf(call: AfterHookCall): string | null {
  if (!call.path || !STANDING_PATHS.has(call.path)) return null;
  if (call.returned === undefined || call.returned instanceof Error) return null;
  const userId = (call.body as { userId?: unknown } | null | undefined)?.userId;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}
