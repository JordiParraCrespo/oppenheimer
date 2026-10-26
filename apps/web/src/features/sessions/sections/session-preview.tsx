import {
  EmptyState,
  IconButton,
  PillTab,
  PillTabs,
  StatusDot,
} from '@oppenheimer/design-system-web';
import { SmartphoneIcon, XIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { DeviceFrame } from '../components/device-frame';
import { useSessionDevice } from '../hooks/use-session-device';

/**
 * The preview pane beside a session (`SessionsConsole.dc.html`): the
 * session's device, live, in a phone's frame. Its header is the design's
 * pill tabs (only Simulator is built; the Browser tab waits for preview URLs),
 * the device's state and name, and Close. The device is the one the session's
 * host gave it, the same one its agent drives through Argent, so the reader
 * watches the agent work and can take over with a tap.
 */
export function SessionPreview({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { status, device, frame, send, type } = useSessionDevice(sessionId);
  const live = status === 'live';
  const name = device?.name ?? t('sessions.preview.simulator');

  return (
    <aside
      aria-label={t('sessions.preview.label')}
      className="flex w-110 min-w-90 shrink-0 flex-col border-l border-border-subtle bg-card"
    >
      <header className="flex min-h-11.5 items-center gap-2 border-b border-border-subtle p-2">
        <PillTabs
          value="simulator"
          onValueChange={() => {}}
          size="sm"
          aria-label={t('sessions.preview.label')}
        >
          <PillTab value="simulator">
            <SmartphoneIcon className="size-3.5" />
            {t('sessions.preview.simulator')}
          </PillTab>
        </PillTabs>
        <StatusDot
          title={t('sessions.preview.title', { name })}
          state={live ? 'running' : 'pending'}
          pulse={status === 'connecting'}
          density="compact"
          className="min-w-0 truncate text-xs text-fg-muted"
        >
          {name}
        </StatusDot>
        <span className="flex-1" />
        <IconButton size="sm" aria-label={t('sessions.preview.close')} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>
      <div className="flex min-h-0 flex-1">
        {live ? (
          <DeviceFrame
            label={t('sessions.preview.frame', { name })}
            frameUrl={frame?.url ?? null}
            onDrawn={() => frame?.drawn()}
            onInput={send}
            onType={type}
          />
        ) : (
          <EmptyState className="m-auto max-w-80">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <SmartphoneIcon />
              </EmptyState.Media>
              <EmptyState.Title>{t(`sessions.preview.${status}`)}</EmptyState.Title>
              {status !== 'ended' ? (
                <EmptyState.Description>
                  {t(`sessions.preview.${status}Detail`)}
                </EmptyState.Description>
              ) : null}
            </EmptyState.Header>
          </EmptyState>
        )}
      </div>
    </aside>
  );
}
