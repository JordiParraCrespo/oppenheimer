import { Button, cn, IconButton, StatusDot } from '@oppenheimer/design-system-web';
import {
  EyeIcon,
  MaximizeIcon,
  MinimizeIcon,
  MousePointerClickIcon,
} from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { useDesktop } from '../hooks/use-desktop';
import { useFullscreen } from '../hooks/use-fullscreen';
import type { DesktopChannel } from '../lib/desktop-channel';
import { DesktopNotice } from './desktop-notice';

/**
 * A host's own desktop, live (`product/research/device-streaming.md`, "A
 * host's desktop"): a bar naming it and saying whether the reader watches or
 * drives it, Take control, Full screen, and the screen scaled into whatever
 * room it is given. It opens watching: clicks and keys reach the host only
 * after Take control, and the host itself drops them until then.
 *
 * `connect` is the product package's factory for one dial; `name` is what the
 * bar calls the machine.
 */
export function DesktopView({
  name,
  connect,
  className,
}: {
  name: string;
  connect: () => Promise<DesktopChannel>;
  className?: string;
}) {
  const { t } = useTranslation();
  const { screenRef, state, setControl, retry } = useDesktop(connect);
  const {
    ref: frameRef,
    active: fullscreen,
    pinned,
    toggle: toggleFullscreen,
  } = useFullscreen<HTMLDivElement>();
  const live = state.status === 'live';

  return (
    <div
      ref={frameRef}
      className={cn(
        'flex min-h-0 flex-1 flex-col bg-card',
        pinned && 'fixed inset-0 z-50',
        className,
      )}
    >
      <div className="flex min-h-9 items-center gap-2 border-b border-border-subtle px-3">
        <StatusDot
          state={live ? 'running' : state.status === 'unavailable' ? 'failed' : 'pending'}
          pulse={state.status === 'connecting' || state.status === 'dropped'}
          density="compact"
          className="min-w-0 flex-1"
          title={t('hosts.desktop.title', { name })}
        >
          {live
            ? t(state.control ? 'hosts.desktop.inControl' : 'hosts.desktop.watching', { name })
            : t('hosts.desktop.title', { name })}
        </StatusDot>
        {live ? (
          <Button
            size="sm"
            variant={state.control ? 'secondary' : 'outline'}
            aria-pressed={state.control}
            onClick={() => setControl(!state.control)}
          >
            {state.control ? <EyeIcon /> : <MousePointerClickIcon />}
            {state.control ? t('hosts.desktop.releaseControl') : t('hosts.desktop.takeControl')}
          </Button>
        ) : null}
        <IconButton
          size="sm"
          aria-label={
            fullscreen ? t('hosts.desktop.exitFullscreen') : t('hosts.desktop.fullscreen')
          }
          aria-pressed={fullscreen}
          onClick={toggleFullscreen}
        >
          {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
        </IconButton>
      </div>
      <div className="relative flex min-h-0 flex-1 bg-surface-sunken">
        <div
          ref={screenRef}
          role="application"
          aria-label={t('hosts.desktop.screen', { name })}
          className={cn('absolute inset-0', !live && 'invisible')}
        />
        {live ? null : <DesktopNotice state={state} onRetry={retry} />}
      </div>
    </div>
  );
}
