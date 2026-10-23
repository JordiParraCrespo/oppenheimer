import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  IconButton,
  SidebarListHead,
} from '@oppenheimer/design-system-web';
import { FolderInput, Pin, PinOff, Trash2, X } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity, SessionEntity } from '@oppenheimer/frontend-consumer';
import { useMoveSession } from '@oppenheimer/frontend-consumer/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionPinsContext } from '../hooks/use-session-pins';
import { useSelectedSessionIds, useSessionSelectionActions } from '../hooks/use-session-selection';
import { settleEach } from '../lib/session-selection';

/**
 * The sidebar's head while rows are picked, in the Projects line's place: how
 * many, and what the picked rows can do together — pin, move to a project,
 * delete — then the way out (Escape does the same). A row that a filter or the
 * search hides stays picked but is neither counted nor acted on: the bar does
 * only what the reader can see it doing.
 *
 * Pin and Move land at once, so the selection clears with them; a move that
 * fails for some rows keeps those picked and says so above the list. Delete
 * asks first, in its dialog, which the sidebar holds.
 */
export function SessionsSelectionBar({
  sessions,
  projects,
  onDelete,
  onWrite,
}: {
  /** The rows the sidebar draws, filtered and searched. */
  sessions: SessionEntity[];
  projects: ProjectEntity[];
  onDelete: (sessions: SessionEntity[]) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const ids = useSelectedSessionIds();
  const { keep, clear } = useSessionSelectionActions();
  const pins = useContext(SessionPinsContext);
  const move = useMoveSession();
  const picked = sessions.filter((session) => ids.includes(session.id));
  const allPinned = picked.length > 0 && picked.every((session) => pins.pins.includes(session.id));

  function togglePins() {
    // A pin goes on top, so the last one pinned leads: pin from the bottom up
    // and the group keeps the order the rows had.
    for (const session of [...picked].reverse()) pins.setPinned(session.id, !allPinned);
    clear();
  }

  async function moveTo(project: ProjectEntity) {
    const moving = picked.filter((session) => session.projectId !== project.id);
    const { failed, reason } = await settleEach(moving, (session) =>
      move.mutateAsync({ id: session.id, projectId: project.id }),
    );
    onWrite(reason ? (reason as Error) : null);
    keep(failed.map((session) => session.id));
    const moved = moving.length - failed.length;
    if (moved === 0) return;
    const name = project.isUnassigned ? t('projects.unassigned') : project.name;
    if (moved === 1) {
      const only = moving.find((session) => !failed.includes(session));
      notifySuccess('sessionMoved', { name: only?.name ?? '', project: name });
    } else {
      notifySuccess('sessionsMoved', { n: String(moved), project: name });
    }
  }

  return (
    <SidebarListHead label={t('sessions.selection.count', { count: picked.length })}>
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={allPinned ? t('sessions.selection.unpin') : t('sessions.selection.pin')}
        disabled={picked.length === 0}
        onClick={togglePins}
      >
        {allPinned ? <PinOff /> : <Pin />}
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton
              size="xs"
              variant="quiet"
              aria-label={t('sessions.selection.move')}
              disabled={picked.length === 0 || move.isPending}
            />
          }
        >
          <FolderInput />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-47.5">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('sessions.sidebar.moveTitle')}</DropdownMenuLabel>
            {projects.map((project) => (
              <DropdownMenuItem key={project.id} onClick={() => void moveTo(project)}>
                {project.isUnassigned ? t('projects.unassigned') : project.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={t('sessions.selection.delete')}
        disabled={picked.length === 0}
        onClick={() => onDelete(picked)}
      >
        <Trash2 />
      </IconButton>
      <IconButton
        size="xs"
        variant="quiet"
        aria-label={t('sessions.selection.clear')}
        onClick={clear}
      >
        <X />
      </IconButton>
    </SidebarListHead>
  );
}
