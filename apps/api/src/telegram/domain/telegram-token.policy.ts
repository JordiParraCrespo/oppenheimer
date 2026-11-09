import type { TelegramAccountStatus } from '@oppenheimer/shared';

/** What the host said when it would not take a token (`TG_001`, `TG_002`, …). */
export interface TelegramTokenRefusal {
  code: string;
  detail?: string;
}

/** How an account stands after its host refused a token. */
export interface TelegramTokenRefusalOutcome {
  status: TelegramAccountStatus;
  statusReason: string;
}

const REASON_MAX = 200;

/**
 * A token the host refused (`telegram.md` §2). The host drops nothing it
 * holds on a refusal, so a bot it was already polling keeps running on its
 * old token: that account stays connected and says the new token did not
 * take. Any other account has no working token: a token Telegram refused
 * (`TG_001`) or one for another bot (`TG_002`) is `revoked`, and a token
 * the host could not get checked (Telegram out of reach) leaves it
 * `unlinked`, to connect again, rather than claim the token was bad.
 */
export function telegramTokenRefusal(
  refusal: TelegramTokenRefusal,
  statusBefore: TelegramAccountStatus,
): TelegramTokenRefusalOutcome {
  const why =
    refusal.code === 'TG_001'
      ? 'Telegram refused that token'
      : (refusal.detail ?? `the host refused it (${refusal.code})`);
  if (statusBefore === 'connected') {
    return {
      status: 'connected',
      statusReason: `The new token was not taken (${why}); the bot keeps its old one`.slice(
        0,
        REASON_MAX,
      ),
    };
  }
  const tokenWasJudged = refusal.code === 'TG_001' || refusal.code === 'TG_002';
  return {
    status: tokenWasJudged ? 'revoked' : 'unlinked',
    statusReason: why.slice(0, REASON_MAX),
  };
}
