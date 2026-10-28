import {
  SidebarEmptyRow,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PINNED_GROUP } from '../hooks/use-sidebar-order';
import { SessionRows } from './session-rows';

/**
 * The sessions the reader pinned, above the projects, under an eyebrow head
 * like Employees' groups. A pinned row is drawn here instead of in its
 * project, in the order it was pinned, with the menu it has there. Its
 * `SortableGroup` takes sessions: one dropped on it is pinned, and its rows
 * drag up or down it or out into a project (`useSidebarOrder`), unless a
 * filter or the search is narrowing the list. With nothing pinned it is drawn
 * only while a session is carried, as the place to drop it. The fold is the
 * group's own.
 */
export function PinnedGroup({
  sessions,
  narrowed,
  onShare,
  onDelete,
  onWrite,
}: {
  sessions: SessionEntity[];
  /** Whether a filter or the search is narrowing the list, which holds the rows still. */
  narrowed: boolean;
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
        id={PINNED_GROUP}
        // A folded group's rows are not drawn, so it holds none; a drop on it still lands.
        items={open ? sessions.map((session) => session.id) : []}
        accepts={['session']}
        data={{ label: t('sessions.sidebar.pinned') }}
        className="flex flex-col"
      >
        <SidebarProjectHeader
          tone="eyebrow"
          name={t('sessions.sidebar.pinned')}
          // The drop hint below says it holds none; a 0 beside it adds nothing.
          count={sessions.length || undefined}
          open={open}
          onOpenChange={setOpen}
          current={current}
        />
        {!open ? null : sessions.length === 0 ? (
          <SidebarEmptyRow>{t('sessions.sidebar.dropToPin')}</SidebarEmptyRow>
        ) : (
          <SessionRows
            sessions={sessions}
            dragDisabled={narrowed}
            onShare={onShare}
            onDelete={onDelete}
            onWrite={onWrite}
          />
        )}
      </SortableGroup>
    </SidebarProjectGroup>
  );
}
