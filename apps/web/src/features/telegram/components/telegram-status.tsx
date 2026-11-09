import { cn, dotVariants } from '@oppenheimer/design-system-web';
import type { TelegramAccountStatus } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/** The run-state dot each bot state reads as: live state is a dot and a word. */
const STATE = {
  connected: 'running',
  connecting: 'queued',
  revoked: 'failed',
  unlinked: 'idle',
} as const satisfies Record<TelegramAccountStatus, string>;

/**
 * How the bot stands, as a dot and a word inside the row's tag; a host that
 * is offline says that instead, since nothing moves until it is back.
 * Connecting breathes while the host checks the token.
 */
export function TelegramStatus({
  status,
  hostOnline,
}: {
  status: TelegramAccountStatus;
  hostOnline: boolean;
}) {
  const { t } = useTranslation();
  const state = hostOnline ? STATE[status] : 'idle';
  return (
    <span className="inline-flex items-center gap-1.5" data-state={state}>
      <span
        aria-hidden
        className={cn(dotVariants({ state }), state === 'queued' && 'motion-safe:animate-pulse')}
      />
      {hostOnline ? t(`settings.telegram.status.${status}`) : t('settings.telegram.hostOffline')}
    </span>
  );
}
