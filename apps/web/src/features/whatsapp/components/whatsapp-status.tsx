import { cn, dotVariants } from '@oppenheimer/design-system-web';
import type { WhatsappAccountStatus } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/** The run-state dot each device state reads as: live state is a dot and a word. */
const STATE = {
  connected: 'running',
  connecting: 'queued',
  pairing: 'waiting',
  logged_out: 'failed',
  unlinked: 'idle',
} as const satisfies Record<WhatsappAccountStatus, string>;

/**
 * How the device stands, as a dot and a word inside the row's tag; a host
 * that is offline says that instead, since nothing moves until it is back.
 * Waiting for a scan breathes, because it is the one state that asks the
 * reader to act.
 */
export function WhatsappStatus({
  status,
  hostOnline,
}: {
  status: WhatsappAccountStatus;
  hostOnline: boolean;
}) {
  const { t } = useTranslation();
  const state = hostOnline ? STATE[status] : 'idle';
  return (
    <span className="inline-flex items-center gap-1.5" data-state={state}>
      <span
        aria-hidden
        className={cn(dotVariants({ state }), state === 'waiting' && 'motion-safe:animate-pulse')}
      />
      {hostOnline ? t(`settings.whatsapp.status.${status}`) : t('settings.whatsapp.hostOffline')}
    </span>
  );
}
