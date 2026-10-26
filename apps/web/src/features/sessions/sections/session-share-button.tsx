import { Button } from '@oppenheimer/design-system-web';
import { EyeIcon, TerminalIcon, UsersIcon } from '@oppenheimer/design-system-web/icons';
import { useSessionShare } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';

/**
 * Share: "Share" while the session is not shared, and once it is, what it is
 * shared as — "Shared · can write · 2", "Shared · view only · link". Either
 * opens the Share dialog.
 *
 * It closes the session's bar on the right (`SessionsConsole.dc.html`, a
 * quiet pill), or, where the screen has no bar of its own to put it in (a
 * pull request's review session), the terminal's status line, as a word in
 * the line's own ink (`place="status"`).
 */
export function SessionShareButton({
  sessionId,
  place = 'bar',
}: {
  sessionId: string;
  place?: 'bar' | 'status';
}) {
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
  const open = () => dialogs.open({ kind: 'share-session', sessionId });

  if (place === 'bar') {
    return (
      <Button variant="ghost" size="sm" title={t('sessions.share.statusTitle')} onClick={open}>
        <Icon />
        {label}
      </Button>
    );
  }
  return (
    <button
      type="button"
      title={t('sessions.share.statusTitle')}
      onClick={open}
      className="ml-auto flex shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-fg outline-none hover:text-link focus-visible:text-link"
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}
