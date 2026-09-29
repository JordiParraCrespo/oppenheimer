import { useNow } from '@oppenheimer/design-system-web';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useTranslation } from 'react-i18next';

/** `mm:ss`, from the seconds left on a token. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * "Token expires in 12:34", ticking once a second.
 *
 * Its own leaf because the tick is: the pairing flow hands out when the token
 * expires, and only this line has to move every second. When the flow ticked
 * instead, the Add host dialog and the onboarding step re-rendered whole —
 * both code blocks included — once a second for as long as they were open.
 *
 * The count is derived from `expiresAt` and the clock rather than decremented,
 * so a tab that was in the background shows the right number when it returns.
 */
export function TokenCountdown({ expiresAt }: { expiresAt: Date }) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.secondMs);
  const seconds = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));

  return <>{t('hosts.pairing.tokenExpires', { time: clock(seconds) })}</>;
}
