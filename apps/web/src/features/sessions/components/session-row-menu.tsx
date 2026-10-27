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
 * A session row's ellipsis menu. Move slides the menu to a pane rather than a
 * submenu, like the account menu's Appearance
 * (`packages/frontend/design-system/AGENTS.md`); the section computes which
 * projects can take the session, since it holds both lists. No key hints: the
 * export draws R, M and D, but nothing listens for them yet, and a painted key
 * that does nothing is a claim. Select starts picking rows to act on
 * together with this one, the way a touch screen with no ⌘-click gets there.
 */
export function SessionRowMenu({
  open,
  onOpenChange,
  pinned,
  onPinChange,
  onSelect,
  onRename,
  onMove,
  onShare,
  onDelete,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  onSelect: () => void;
  onRename: () => void;
  onMove: (projectId: string) => void;
  /** Absent: a session with no terminal to share (a cloud one, shared at its vendor). */
  onShare?: () => void;
  onDelete: () => void;
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
            <DropdownMenuItem onClick={() => onPinChange(!pinned)}>
              {pinned ? t('sessions.sidebar.unpin') : t('sessions.sidebar.pin')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSelect}>{t('sessions.sidebar.select')}</DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>{t('sessions.sidebar.rename')}</DropdownMenuItem>
            <DropdownMenuPaneItem onClick={() => setPane('move')}>
              {t('sessions.sidebar.move')}
            </DropdownMenuPaneItem>
            {onShare ? (
              <DropdownMenuItem onClick={onShare}>{t('sessions.sidebar.share')}</DropdownMenuItem>
            ) : null}
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
