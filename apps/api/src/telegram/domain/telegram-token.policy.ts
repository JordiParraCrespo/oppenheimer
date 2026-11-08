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
 * take. Any other account has no working token and needs a new one.
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
  return { status: 'revoked', statusReason: why.slice(0, REASON_MAX) };
}
