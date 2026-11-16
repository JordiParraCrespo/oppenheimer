import { EmptyState, IconButton, StatusDot } from '@oppenheimer/design-system-web';
import { RotateCwIcon, SmartphoneIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { DeviceFrame } from '../components/device-frame';
import { DevicePicker } from '../components/device-picker';
import { DeviceReconnecting } from '../components/device-reconnecting';
import { useSessionDevice } from '../hooks/use-session-device';

/**
 * The preview pane's Simulator: the session's device, live, in a phone's
 * frame, under a line saying which device and whether it is streaming. The
 * device is the one the session's host gave it, the same one its agent drives
 * through Argent, so the reader watches the agent work and can take over with
 * a tap. When the host offers more than one, the line is a picker that moves
 * the session onto another free device; Refresh looks at the host's devices
 * again and restarts the screen. Its socket is open while this tab is shown.
 * While the stream redials, the last frame stays with a notice over it, and
 * taps made meanwhile are held and sent once it is live again.
 */
export function SessionDevice({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const { status, device, frame, send, type, select, refresh } = useSessionDevice(sessionId);
  const live = status === 'live';
  // A stream that was showing the device and dropped: keep its last frame.
  const reconnecting = (status === 'connecting' || status === 'offline') && frame !== null;
  const name = device?.name ?? t('sessions.preview.simulator');
  const choices = device?.devices ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-9 items-center gap-1 border-b border-border-subtle py-1 pr-2 pl-3">
        {live && device && choices.length > 1 ? (
          <DevicePicker device={device} choices={choices} onSelect={select} />
        ) : (
          <StatusDot
            title={t('sessions.preview.title', { name })}
            state={live ? 'running' : 'pending'}
            pulse={status === 'connecting'}
            density="compact"
            className="min-w-0"
          >
            {name}
          </StatusDot>
        )}
        <span className="flex-1" />
        {status !== 'ended' ? (
          <IconButton
            size="sm"
            aria-label={t('sessions.preview.refreshDevice')}
            title={t('sessions.preview.refreshDevice')}
            onClick={refresh}
            disabled={status === 'connecting'}
          >
            <RotateCwIcon />
          </IconButton>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1">
        {live || reconnecting ? (
          <DeviceFrame
            label={t('sessions.preview.frame', { name })}
            frameUrl={frame?.url ?? null}
            onDrawn={() => frame?.drawn()}
            onInput={send}
            onType={type}
          >
            {reconnecting ? <DeviceReconnecting offline={status === 'offline'} /> : null}
          </DeviceFrame>
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
