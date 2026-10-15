import { EyeIcon, TerminalIcon, UsersIcon } from '@oppenheimer/design-system-web/icons';
import { useSessionShare } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';

/**
 * Share, at the right end of a session's status line
 * (`SessionsConsole (pages).dc.html`): "Share" while the session is not
 * shared, and once it is, what it is shared as — "Shared · can write · 2",
 * "Shared · view only · link". Either opens the Share dialog.
 */
export function SessionShareButton({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const dialogs = useConsoleDialog();
  const { data: share } = useSessionShare(sessionId);
  const Icon = !share ? UsersIcon : share.access === 'write' ? TerminalIcon : EyeIcon;
  const label = !share
    ? t('sessions.share.status.share')
    : [
        t(`sessions.share.status.${share.access}`),
        share.audience === 'link' ? t('sessions.share.status.link') : String(share.people.length),
      ].join(' · ');

  return (
    <button
      type="button"
      title={t('sessions.share.statusTitle')}
      onClick={() => dialogs.open({ kind: 'share-session', sessionId })}
      className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-fg outline-none hover:text-link focus-visible:text-link"
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
