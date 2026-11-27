import { useRowMenu } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { SidebarPinnedGroup } from '@oppenheimer/frontend-web';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PINNED_GROUP } from '../hooks/use-sidebar-order';
import { GroupSessionsMenu } from './group-sessions-menu';
import { SessionRows } from './session-rows';

/**
 * The sessions the reader pinned, above the projects, in the kit's
 * `SidebarPinnedGroup`. A pinned row is drawn here instead of in its
 * project, in the order it was pinned, with the menu it has there. A session
 * dropped on it is pinned, and its rows drag up or down it or out into a
 * project (`useSidebarOrder`), filtered or not. With nothing pinned it is drawn only while a session is carried, as
 * the place to drop it. Its head's menu (`GroupSessionsMenu`) hides or
 * deletes every pinned row.
 */
export function PinnedGroup({
  sessions,
  onShare,
  onDelete,
  onDeleteAll,
  onWrite,
}: {
  sessions: SessionEntity[];
  onShare: (session: SessionEntity) => void;
  onDelete: (session: SessionEntity) => void;
  onDeleteAll: (sessions: SessionEntity[]) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const label = t('sessions.sidebar.pinned');
  const menu = useRowMenu(sessions.length > 0);
  // A pinned open session is in no project, so this head carries the mark.
  const current = useRouterState({
    select: (state) =>
      sessions.some((session) => state.location.pathname === `/sessions/${session.id}`),
  });

  return (
    <SidebarPinnedGroup
      id={PINNED_GROUP}
      label={label}
      items={sessions.map((session) => session.id)}
      accepts={['session']}
      emptyHint={t('sessions.sidebar.dropToPin')}
      current={current}
      onContextMenu={menu.onContextMenu}
      menuOpen={menu.open}
      actions={
        sessions.length > 0 ? (
          <GroupSessionsMenu
            label={label}
            sessions={sessions}
            open={menu.open}
            onOpenChange={menu.setOpen}
            onDeleteAll={onDeleteAll}
            onWrite={onWrite}
          />
        ) : undefined
      }
    >
      <SessionRows sessions={sessions} onShare={onShare} onDelete={onDelete} onWrite={onWrite} />
    </SidebarPinnedGroup>
  );
}
