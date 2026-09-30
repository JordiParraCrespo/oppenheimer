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
 * Its own leaf so only this line re-renders every second; when the flow
 * ticked, the Add host dialog and onboarding step re-rendered whole. The count
 * is derived from `expiresAt` and the clock rather than decremented, so a
 * backgrounded tab shows the right number when it returns.
 */
export function TokenCountdown({ expiresAt }: { expiresAt: Date }) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everySecondMs);
  const seconds = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));

  return <>{t('hosts.pairing.tokenExpires', { time: clock(seconds) })}</>;
}
