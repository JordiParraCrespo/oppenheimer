import { useNow } from '@oppenheimer/design-system-web';
import { useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { shareTimeLeft } from '../lib/share-session';

/** The guest page's "Ends in 23h 41m", a leaf of its own so the minute tick redraws only it. */
export function SharedEndsIn({ at }: { at: Date }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  return (
    <span className="figures">
      {t('sessions.shared.endsIn', { time: shareTimeLeft(at.getTime() - now, locale, t) })}
    </span>
  );
}
