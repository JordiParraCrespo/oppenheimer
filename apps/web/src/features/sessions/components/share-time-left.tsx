import { useNow } from '@oppenheimer/design-system-web';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { shareTimeLeft } from '../lib/share-session';

/**
 * What a live share has left, as Share's Expires button reads it ("23h
 * 41m", "Never", "Ended"): a leaf of its own, so the minute tick redraws
 * only it.
 */
export function ShareTimeLeft({ at }: { at: Date | null }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  if (at === null) return <>{t('sessions.share.lifetimes.never')}</>;
  const left = at.getTime() - now;
  return (
    <span className="figures">
      {left <= 0 ? t('sessions.share.expired') : shareTimeLeft(left, locale, t)}
    </span>
  );
}
