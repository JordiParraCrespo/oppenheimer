import {
  DropdownMenu,
  DropdownMenuBack,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPaneItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  SearchList,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moveProjectOptions } from '../lib/session-groups';

/** Which pane the menu shows: its first level, or one an item slid it to. */
type Pane = 'root' | 'move' | 'notify';

/**
 * A session row's ellipsis menu. Move slides the menu to a pane rather than a
 * submenu, like the account menu's Appearance, and so does Notifications &
 * read, which holds the reader's own marks on this device (unread, muted).
 * The section computes which project the session is in, since it holds both
 * lists; that one stays listed, ticked and not choosable, so the pane says
 * where the session is. No key
 * hints: the export draws R, M and D, but nothing listens for them yet, and a
 * painted key that does nothing is a claim. Select starts picking rows to act
 * on together with this one, the way a touch screen with no ⌘-click gets
 * there.
 */
export function SessionRowMenu({
  open,
  onOpenChange,
  pinned,
  onPinChange,
  unread,
  onUnreadChange,
  muted,
  onMutedChange,
  hidden,
  onHiddenChange,
  onSelect,
  onRename,
  onMove,
  onShare,
  onDelete,
  projects,
  currentProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  /** Whether the reader marked the session to come back to. */
  unread: boolean;
  onUnreadChange: (unread: boolean) => void;
  /** Whether the reader turned off this session's system notifications on this device. */
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
  onSelect: () => void;
  onRename: () => void;
  onMove: (projectId: string) => void;
  /** Absent: a session with no terminal to share (a cloud one, shared at its vendor). */
  onShare?: () => void;
  onDelete: () => void;
  projects: { id: string; name: string; isUnassigned?: boolean }[];
  /** The project the session is in: shown ticked, and not a target. */
  currentProjectId: string | null;
}) {
  const { t } = useTranslation();
  const [pane, setPane] = useState<Pane>('root');

  const back = (title: string) => (
    <>
      <DropdownMenuBack onClick={() => setPane('root')}>{title}</DropdownMenuBack>
      <DropdownMenuSeparator />
    </>
  );
  // Each pane owns its width and what it draws: a new pane is a row here.
  const panes: Record<Pane, { width: string; render: () => ReactNode }> = {
    root: {
      width: 'min-w-47.5',
      render: () => (
        <>
          <DropdownMenuItem onClick={() => onPinChange(!pinned)}>
            {pinned ? t('sessions.sidebar.unpin') : t('sessions.sidebar.pin')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>{t('sessions.sidebar.rename')}</DropdownMenuItem>
          <DropdownMenuPaneItem onClick={() => setPane('move')}>
            {t('sessions.sidebar.move')}
          </DropdownMenuPaneItem>
          {onShare ? (
            <DropdownMenuItem onClick={onShare}>{t('sessions.sidebar.share')}</DropdownMenuItem>
          ) : null}
          <DropdownMenuPaneItem onClick={() => setPane('notify')}>
            {t('sessions.sidebar.notifyTitle')}
          </DropdownMenuPaneItem>
          <DropdownMenuItem onClick={onSelect}>{t('sessions.sidebar.select')}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onHiddenChange(!hidden)}>
            {hidden ? t('sessions.sidebar.show') : t('sessions.sidebar.hide')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            {t('sessions.sidebar.delete')}
          </DropdownMenuItem>
        </>
      ),
    },
    notify: {
      width: 'min-w-47.5',
      render: () => (
        <>
          {back(t('sessions.sidebar.notifyTitle'))}
          <DropdownMenuItem onClick={() => onUnreadChange(!unread)}>
            {unread ? t('sessions.sidebar.markRead') : t('sessions.sidebar.markUnread')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMutedChange(!muted)}>
            {muted ? t('sessions.sidebar.unmute') : t('sessions.sidebar.mute')}
          </DropdownMenuItem>
        </>
      ),
    },
    move: {
      width: 'w-68',
      render: () => (
        <>
          {back(t('sessions.sidebar.moveTitle'))}
          {projects.length === 0 ? (
            <DropdownMenuItem disabled>{t('sessions.sidebar.moveNone')}</DropdownMenuItem>
          ) : (
            <SearchList
              className="-mx-1 -mb-1"
              aria-label={t('sessions.sidebar.moveTitle')}
              options={moveProjectOptions(t, projects, currentProjectId)}
              value={currentProjectId}
              onPick={(option) => {
                onMove(option.value);
                onOpenChange(false);
                setPane('root');
              }}
              searchPlaceholder={t('common.search.projects')}
              emptyText={(query) => t('common.search.noMatch', { query })}
            />
          )}
        </>
      ),
    },
  };
  const current = panes[pane];

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
      <DropdownMenuContent align="end" className={current.width}>
        {current.render()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
