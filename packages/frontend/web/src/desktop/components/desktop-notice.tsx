import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { MonitorIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import type { DesktopViewState } from '../lib/desktop-channel';

/** The refusals the runner names, each with its own words and remedy. */
const REFUSALS = ['DESKTOP_001', 'DESKTOP_002', 'DESKTOP_003', 'DESKTOP_004'] as const;
type KnownRefusal = (typeof REFUSALS)[number];

function knownRefusal(code: string | undefined): KnownRefusal | null {
  return REFUSALS.find((known) => known === code) ?? null;
}

/** What each state with no screen says, as a title and a line under it. */
const WAITING = {
  connecting: ['hosts.desktop.connecting', 'hosts.desktop.connectingDetail'],
  live: ['hosts.desktop.connecting', 'hosts.desktop.connectingDetail'],
  dropped: ['hosts.desktop.dropped', 'hosts.desktop.droppedDetail'],
  offline: ['hosts.desktop.offline', 'hosts.desktop.offlineDetail'],
  ended: ['hosts.desktop.ended', 'hosts.desktop.endedDetail'],
} as const;

/**
 * What stands where the screen will be while there is none: on its way, the
 * host away, or the host's answer and what its owner can do about it there.
 * A refusal offers Try again, since the fix (`runner desktop on`, a server
 * started) happens on the host, out of the console's sight.
 */
export function DesktopNotice({
  state,
  onRetry,
}: {
  state: DesktopViewState;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const refusal = state.status === 'unavailable' ? knownRefusal(state.refusal?.code) : null;

  return (
    <EmptyState className="m-auto max-w-96">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <MonitorIcon />
        </EmptyState.Media>
        {state.status === 'unavailable' ? (
          <>
            <EmptyState.Title>
              {refusal
                ? t(`hosts.desktop.refused.${refusal}.title`)
                : t('hosts.desktop.refused.other.title')}
            </EmptyState.Title>
            <EmptyState.Description>
              {refusal
                ? t(`hosts.desktop.refused.${refusal}.detail`)
                : (state.refusal?.detail ?? t('hosts.desktop.refused.other.detail'))}
            </EmptyState.Description>
          </>
        ) : (
          <>
            <EmptyState.Title>{t(WAITING[state.status][0])}</EmptyState.Title>
            <EmptyState.Description>{t(WAITING[state.status][1])}</EmptyState.Description>
          </>
        )}
      </EmptyState.Header>
      {refusal === 'DESKTOP_001' ? (
        <code className="rounded-sm bg-surface-sunken px-2 py-1 font-mono text-sm text-fg">
          runner desktop on
        </code>
      ) : null}
      {state.status === 'unavailable' ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          {t('hosts.desktop.tryAgain')}
        </Button>
      ) : null}
    </EmptyState>
  );
}
