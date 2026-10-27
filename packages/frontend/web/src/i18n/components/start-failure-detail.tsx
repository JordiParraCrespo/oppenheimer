import { cn } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The host's own words under a failed start's reason: English, for whoever
 * reads its logs, so a small secondary line and never the reason itself.
 */
export function StartFailureDetail({ detail, className }: { detail: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cn('text-xs break-words text-fg-subtle', className)}>
      {t('errors.startFailure.details', { detail })}
    </p>
  );
}
