import { EmptyState, StatusDot } from '@oppenheimer/design-system-web';
import { SmartphoneIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { DeviceFrame } from '../components/device-frame';
import { useSessionDevice } from '../hooks/use-session-device';

/**
 * The preview pane's Simulator: the session's device, live, in a phone's
 * frame, under a line saying which device and whether it is streaming. The
 * device is the one the session's host gave it, the same one its agent drives
 * through Argent, so the reader watches the agent work and can take over with
 * a tap. Its socket is open while this tab is shown.
 */
export function SessionDevice({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const { status, device, frame, send, type } = useSessionDevice(sessionId);
  const live = status === 'live';
  const name = device?.name ?? t('sessions.preview.simulator');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-9 items-center border-b border-border-subtle px-3">
        <StatusDot
          title={t('sessions.preview.title', { name })}
          state={live ? 'running' : 'pending'}
          pulse={status === 'connecting'}
          density="compact"
          className="min-w-0"
        >
          {name}
        </StatusDot>
      </div>
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
    </div>
  );
}
