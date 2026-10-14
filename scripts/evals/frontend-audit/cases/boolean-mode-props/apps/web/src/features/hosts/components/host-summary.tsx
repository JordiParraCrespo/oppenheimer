import { StatusDot } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * A host in one line. `compact` is the chip in the strip above the list: the
 * name alone, small. `showStatus` adds the dot, `showRunner` the runner's
 * version, `showSessions` how many sessions it is running.
 */
export function HostSummary({
  host,
  compact = false,
  showStatus = false,
  showRunner = false,
  showSessions = false,
}: {
  host: HostEntity;
  compact?: boolean;
  showStatus?: boolean;
  showRunner?: boolean;
  showSessions?: boolean;
}) {
  const { t } = useTranslation();
  const name = compact ? host.name : host.summary;

  return (
    <div className={compact ? 'flex items-center gap-1.5' : 'flex items-center gap-3 py-2'}>
      {showStatus ? (
        <StatusDot
          state={host.online ? 'running' : 'idle'}
          density={compact ? 'compact' : 'default'}
        >
          {name}
        </StatusDot>
      ) : (
        <span
          className={compact ? 'truncate text-sm text-fg' : 'min-w-0 flex-1 text-operate text-fg'}
        >
          {name}
        </span>
      )}
      {!compact && showRunner && host.runnerVersion ? (
        <span className="text-sm text-fg-muted">
          {t('hosts.settings.meta.runner', { version: host.runnerVersion })}
        </span>
      ) : null}
      {!compact && showSessions ? (
        <span className="figures text-sm text-fg-muted">{host.details.runningSessionCount}</span>
      ) : null}
    </div>
  );
}
