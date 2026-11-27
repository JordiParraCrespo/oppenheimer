import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useSetSessionHidden } from '@oppenheimer/frontend-consumer/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { settleEach } from '../lib/session-selection';

/**
 * A sidebar group's menu, at its header's ellipsis or on a right-click
 * anywhere on the header: hide every session the group lists, or show them
 * again when all of them are hidden, and delete them all, which asks first in
 * the sidebar's dialog for several. It acts on the rows the group counts, so
 * a filter, the search or Pinned holding some of them keeps those out, as the
 * selection bar does only what the reader can see.
 *
 * The hides go out side by side; the ones that land toast once, and the first
 * one refused shows above the list.
 */
export function GroupSessionsMenu({
  label,
  sessions,
  open,
  onOpenChange,
  onDeleteAll,
  onWrite,
}: {
  /** The group's name, for the trigger's accessible name. */
  label: string;
  sessions: SessionEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteAll: (sessions: SessionEntity[]) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const visibility = useSetSessionHidden();
  const allHidden = sessions.every((session) => session.hidden);

  async function setHidden(hidden: boolean) {
    const changing = sessions.filter((session) => session.hidden !== hidden);
    const { failed, reason } = await settleEach(changing, (session) =>
      visibility.mutateAsync({ id: session.id, hidden }),
    );
    onWrite(reason ? (reason as Error) : null);
    const changed = changing.filter((session) => !failed.includes(session));
    if (changed.length === 0) return;
    if (changed.length === 1) {
      notifySuccess(hidden ? 'sessionHidden' : 'sessionShown', { name: changed[0]?.name ?? '' });
    } else {
      notifySuccess(hidden ? 'sessionsHidden' : 'sessionsShown', { n: String(changed.length) });
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <IconButton
            size="xs"
            variant="quiet"
            aria-label={t('sessions.group.actions', { name: label })}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-47.5">
        <DropdownMenuItem
          disabled={visibility.isPending}
          onClick={() => void setHidden(!allHidden)}
        >
          {allHidden ? t('sessions.group.showAll') : t('sessions.group.hideAll')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDeleteAll(sessions)}>
          {t('sessions.group.deleteAll')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
