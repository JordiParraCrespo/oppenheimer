import { useTranslation } from 'react-i18next';
import { useSecondsSince } from '../hooks/use-seconds-since';

/**
 * How long ago a host last answered, counting up. It owns its own tick so the
 * row around it, and the list around that, never re-render for it.
 */
export function LastSeen({ since }: { since: Date | null }) {
  const { t } = useTranslation();
  const seconds = useSecondsSince(since);
  if (seconds === null) return null;

  return (
    <span className="figures text-fg-muted">
      {seconds < 60
        ? t('common.relative.now')
        : t('common.relative.minute', { count: Math.floor(seconds / 60) })}
    </span>
  );
}
