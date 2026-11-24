import { LoaderCircle } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * Over the phone's last frame while its stream redials: the screen is not
 * live, and a tap made now is held and sent once it is. It takes no pointer,
 * so the reader's taps still reach the frame under it.
 */
export function DeviceReconnecting({ offline }: { offline: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex items-center justify-center bg-overlay px-4 backdrop-blur-[3px]"
    >
      <div className="flex max-w-60 flex-col items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-card px-4 py-3 text-center shadow-panel">
        <LoaderCircle className="size-4 text-fg-muted motion-safe:animate-spin" />
        <p className="text-sm font-medium text-fg">
          {t(offline ? 'sessions.preview.offline' : 'sessions.preview.reconnecting')}
        </p>
        <p className="text-xs text-fg-muted">{t('sessions.preview.reconnectingDetail')}</p>
      </div>
    </div>
  );
}
