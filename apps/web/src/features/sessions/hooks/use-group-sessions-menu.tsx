import { useRowMenu } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { GroupSessionsMenu } from '../sections/group-sessions-menu';

/**
 * A sidebar group header's menu, wired once for every group that has one (a
 * project, the unfiled group, Pinned): the ellipsis to place among the
 * header's actions, and the right-click and open state to hand the header.
 * A group with no rows has nothing for the menu to act on, so it gets none:
 * no ellipsis, and the browser's own menu on a right-click.
 */
export function useGroupSessionsMenu({
  label,
  sessions,
  onDeleteAll,
  onWrite,
}: {
  label: string;
  sessions: SessionEntity[];
  onDeleteAll: (sessions: SessionEntity[]) => void;
  onWrite: (error: Error | null) => void;
}) {
  const enabled = sessions.length > 0;
  const menu = useRowMenu(enabled);
  return {
    action: enabled ? (
      <GroupSessionsMenu
        label={label}
        sessions={sessions}
        open={menu.open}
        onOpenChange={menu.setOpen}
        onDeleteAll={onDeleteAll}
        onWrite={onWrite}
      />
    ) : undefined,
    onContextMenu: menu.onContextMenu,
    menuOpen: menu.open,
  };
}
