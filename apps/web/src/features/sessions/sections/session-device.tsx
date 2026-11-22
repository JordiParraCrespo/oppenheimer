import { EmptyState, IconButton, StatusDot } from '@oppenheimer/design-system-web';
import { LoaderIcon, RotateCwIcon, SmartphoneIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { DeviceFrame } from '../components/device-frame';
import { DevicePicker } from '../components/device-picker';
import { useSessionDevice } from '../hooks/use-session-device';

/**
 * The preview pane's Simulator: the session's device, live, in a phone's
 * frame, under a line saying which device and whether it is streaming. The
 * device is the one the session's host gave it, the same one its agent drives
 * through Argent, so the reader watches the agent work and can take over with
 * a tap. When the host offers more than one, the line is a picker that moves
 * the session onto another free device; Refresh looks at the host's devices
 * again and restarts the screen. Its socket is open while this tab is shown.
 *
 * Until the device sends its first picture the phone says it is waiting,
 * rather than a black screen under a green dot.
 */
export function SessionDevice({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const { status, device, frame, send, type, select, refresh } = useSessionDevice(sessionId);
  const live = status === 'live';
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
        {live ? (
          <DeviceFrame
            label={t('sessions.preview.frame', { name })}
            frameUrl={frame?.url ?? null}
            onDrawn={() => frame?.drawn()}
            onInput={send}
            onType={type}
          >
            <LoaderIcon
              aria-hidden
              className="size-5 text-device-screen-fg-muted motion-safe:animate-spin"
            />
            <p role="status" className="text-sm font-medium text-device-screen-fg">
              {t('sessions.preview.noPicture')}
            </p>
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
