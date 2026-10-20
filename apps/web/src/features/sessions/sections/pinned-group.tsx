import {
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionRows } from './session-rows';

/**
 * The sessions the reader pinned, above the projects, under an eyebrow head
 * like Employees' groups: a pin is the reader's shortcut, not a project, so
 * its `SortableGroup` takes no drop and its rows do not drag. A pinned row is
 * drawn here instead of in its project, in the order it was pinned, with the
 * menu it has there. The fold is the group's own.
 */
export function PinnedGroup({
  sessions,
  onShare,
  onDelete,
  onWrite,
}: {
  sessions: SessionEntity[];
  onShare: (session: SessionEntity) => void;
  onDelete: (session: SessionEntity) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  // A pinned open session is in no project, so this head carries the mark.
  const current = useRouterState({
    select: (state) =>
      sessions.some((session) => state.location.pathname === `/sessions/${session.id}`),
  });

  return (
    <SidebarProjectGroup>
      <SortableGroup
        id="pinned"
        items={open ? sessions.map((session) => session.id) : []}
        accepts={[]}
        className="flex flex-col"
      >
        <SidebarProjectHeader
          tone="eyebrow"
          name={t('sessions.sidebar.pinned')}
          count={sessions.length}
          open={open}
          onOpenChange={setOpen}
          current={current}
        />
        {open ? (
          <SessionRows
            sessions={sessions}
            dragDisabled
            onShare={onShare}
            onDelete={onDelete}
            onWrite={onWrite}
          />
        ) : null}
      </SortableGroup>
    </SidebarProjectGroup>
  );
}
