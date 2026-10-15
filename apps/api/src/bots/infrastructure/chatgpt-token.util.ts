import type { ChatgptTokens } from './chatgpt-auth.port';

/** Where an OpenAI access token keeps the ChatGPT account it acts for. */
const AUTH_CLAIM = 'https://api.openai.com/auth';

/** The JSON object `text` holds, or an empty one. */
export function jsonOf(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The ChatGPT account an access token names, read from its claims (not verified: ChatGPT does that). */
export function accountIdOfAccessToken(accessToken: string): string | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  const claims = jsonOf(Buffer.from(payload, 'base64url').toString('utf8'));
  const auth = claims[AUTH_CLAIM];
  const accountId =
    typeof auth === 'object' && auth !== null
      ? (auth as Record<string, unknown>).chatgpt_account_id
      : undefined;
  return typeof accountId === 'string' && accountId.length > 0 ? accountId : null;
}

/** The tokens of an `/oauth/token` answer, or null when it is missing a part. */
export function chatgptTokensOf(body: Record<string, unknown>, now: number): ChatgptTokens | null {
  const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = body;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') return null;
  if (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) return null;
  const accountId = accountIdOfAccessToken(accessToken);
  if (!accountId) return null;
  return { accessToken, refreshToken, expiresAt: new Date(now + expiresIn * 1000), accountId };
}
