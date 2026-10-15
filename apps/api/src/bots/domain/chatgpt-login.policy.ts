/**
 * A ChatGPT sign-in in progress (`product/versions/mvp/25-bots.md` §2): the
 * device code ChatGPT handed out, the workspace it was started for and when it
 * lapses. The API keeps nothing while it waits; the console holds it, sealed,
 * and hands it back on every poll.
 */
export interface ChatgptLoginFlow {
  deviceAuthId: string;
  userCode: string;
  organizationId: string;
  expiresAt: Date;
}

/** How long a device code is polled for: the Codex CLI gives up after fifteen minutes. */
export const CHATGPT_LOGIN_TTL_MS = 15 * 60_000;

/** Refreshed this long before ChatGPT's expiry, so a turn never starts on a token about to lapse. */
export const CHATGPT_REFRESH_MARGIN_MS = 5 * 60_000;

export function chatgptLoginExpiry(now: Date): Date {
  return new Date(now.getTime() + CHATGPT_LOGIN_TTL_MS);
}

/** Whether a poll may go on with `flow`: started for this workspace, and not past its time. */
export function isChatgptLoginOpen(
  flow: ChatgptLoginFlow,
  organizationId: string,
  now: Date,
): boolean {
  return flow.organizationId === organizationId && flow.expiresAt.getTime() > now.getTime();
}

/** Whether an access token expiring at `expiresAt` can still start a turn. */
export function isChatgptTokenFresh(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() - now.getTime() > CHATGPT_REFRESH_MARGIN_MS;
}
