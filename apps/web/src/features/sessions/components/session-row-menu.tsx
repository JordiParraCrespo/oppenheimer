import {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPaneItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A session row's ellipsis menu: Rename, Move to project…, Delete.
 *
 * Move slides the same menu to a pane rather than opening a submenu — the
 * pick belongs to the row, the way the account menu's Appearance does
 * (`packages/frontend/design-system/AGENTS.md`). The pane lists only the
 * projects that can take the session; the section computes which, because it
 * is the one holding both lists. An empty pane says why.
 *
 * No key hints: the export draws R, M and D beside the rows, and nothing
 * listens for them yet. A painted key that does nothing is a claim, so they
 * come back with the handler.
 *
 * Props in, choice out: the mutations are the section's and the dialog's.
 */
export function SessionRowMenu({
  open,
  onOpenChange,
  onRename,
  onMove,
  onDelete,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onMove: (projectId: string) => void;
  onDelete: () => void;
  /** Where the session may move: every other project holding its repository. */
  projects: { id: string; name: string; isUnassigned?: boolean }[];
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<'root' | 'move'>('root');

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setPane('root');
      }}
    >
      <DropdownMenuTrigger
        render={<IconButton aria-label={t('sessions.sidebar.actions')} size="xs" variant="quiet" />}
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-47.5">
        {pane === 'root' ? (
          <>
            <DropdownMenuItem onClick={onRename}>{t('sessions.sidebar.rename')}</DropdownMenuItem>
            <DropdownMenuPaneItem onClick={() => setPane('move')}>
              {t('sessions.sidebar.move')}
            </DropdownMenuPaneItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              {t('sessions.sidebar.delete')}
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuBack onClick={() => setPane('root')}>
              {t('sessions.sidebar.moveTitle')}
            </DropdownMenuBack>
            <DropdownMenuSeparator />
            {projects.length === 0 ? (
              <DropdownMenuItem disabled>{t('sessions.sidebar.moveNone')}</DropdownMenuItem>
            ) : (
              projects.map((project) => (
                <DropdownMenuItem key={project.id} onClick={() => onMove(project.id)}>
                  {project.isUnassigned ? t('projects.unassigned') : project.name}
                </DropdownMenuItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
