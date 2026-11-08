import { cn } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The host's own words under a failed start's reason: English, for whoever
 * reads its logs, so a small secondary block and never the reason itself. Its
 * lines stay lines, in the terminal's monospace, and a long one scrolls inside
 * the block rather than growing the page.
 */
export function StartFailureDetail({ detail, className }: { detail: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <p className="text-xs text-fg-subtle">{t('errors.startFailure.details')}</p>
      <pre className="m-0 max-h-40 overflow-y-auto rounded-sm bg-hover-surface px-3 py-2 font-mono text-[11.5px] leading-[1.6] break-normal whitespace-pre-wrap text-fg-muted [overflow-wrap:anywhere]">
        {detail}
      </pre>
    </div>
  );
}
