import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { EyeIcon, TerminalIcon, UsersIcon } from '@oppenheimer/design-system-web/icons';
import { useSessionShare } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { ShareSession } from './share-session';

/**
 * Share: "Share" while the session is not shared, and once it is, what it is
 * shared as — "Shared · can write · 2", "Shared · view only · link".
 *
 * It closes the session's bar on the right as a quiet square icon, lit
 * while the session is shared, the words its label and tooltip, and opens
 * Share as a popover under it. Where the screen has no bar of its own to put
 * it in (a pull request's review session) it is the terminal's status line,
 * a word in the line's own ink (`place="status"`), and opens the Share
 * dialog.
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

  if (place === 'bar') {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <IconButton
              size="sm"
              shape="square"
              aria-label={label}
              title={share ? label : t('sessions.share.statusTitle')}
              data-dirty={share ? '' : undefined}
            />
          }
        >
          <UsersIcon />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="max-h-[calc(100dvh-80px)] w-105 max-w-[calc(100vw-24px)] gap-0 p-0"
        >
          <ShareSession sessionId={sessionId} Title={PopoverTitle} />
        </PopoverContent>
      </Popover>
    );
  }
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
