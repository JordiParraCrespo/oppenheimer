import { DragProvider, SidebarListHead, SortableGroup } from '@oppenheimer/design-system-web';
import { OfflineOnce, QueryState, useDragLabels } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionsSidebarSkeleton } from '../components/sessions-sidebar-skeleton';
import { SidebarSectionItem } from '../components/sidebar-section-item';
import { useFoldedSessions } from '../hooks/use-folded-sessions';
import { useSidebarSections } from '../hooks/use-sidebar-sections';
import { NewSessionButton } from './new-session-button';
import { SessionsSidebarBody } from './sessions-sidebar-body';

/** The sortable group the sidebar's sections are ordered in. */
const SECTIONS_GROUP = 'sidebar-sections';

/**
 * The console's sidebar body: New session, which needs no read and stays in
 * every state, the section's bots (`bots`, the route's to compose, since they
 * are another feature's), and the sessions, read under Suspense.
 * Offline, both fail the same way, so `OfflineOnce` says so once above them.
 *
 * The reader drags Bots and Sessions by their headings into the order they
 * want (`useSidebarSections`, kept on this device), on a drag surface of
 * their own: the sessions list keeps its own for its rows and projects.
 * Each heading folds its section too, so either can be moved out of the way.
 */
export function SessionsSidebar({ bots }: { bots?: ReactNode }) {
  const { t } = useTranslation();
  const list = useFoldedSessions();
  const sections = useSidebarSections();
  const dragLabels = useDragLabels();
  const labels = {
    bots: t('bots.section.heading'),
    sessions: t('sessions.sidebar.sessions'),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <NewSessionButton />
      </div>
      <OfflineOnce className="mx-3 mb-2">
        <DragProvider
          labels={dragLabels}
          onDragEnd={({ active, over }) => {
            if (over) sections.move(active.id, over.id);
          }}
          overlay={(active) => (
            <div className="w-60 rounded-nav bg-sidebar py-1">
              <SidebarListHead label={active.data.label ?? active.id} />
            </div>
          )}
        >
          <SortableGroup
            id={SECTIONS_GROUP}
            items={sections.order}
            accepts={['sidebar-section']}
            className="flex min-h-0 flex-1 flex-col"
          >
            {sections.order.map((id) =>
              id === 'bots' ? (
                bots ? (
                  <SidebarSectionItem
                    key={id}
                    id={id}
                    label={labels.bots}
                    moveLabel={t('sessions.sidebar.moveSection', { name: labels.bots })}
                  >
                    {bots}
                  </SidebarSectionItem>
                ) : null
              ) : (
                <SidebarSectionItem
                  key={id}
                  id={id}
                  label={labels.sessions}
                  moveLabel={t('sessions.sidebar.moveSection', { name: labels.sessions })}
                  grow={list.open}
                >
                  <QueryState>
                    <QueryState.Pending>
                      <SessionsSidebarSkeleton open={list.open} />
                    </QueryState.Pending>
                    <QueryState.Error
                      fallback={t('sessions.sidebar.loadFailed')}
                      className="mx-3 mt-2"
                      offlineOnce
                    />
                    <QueryState.Data>
                      <SessionsSidebarBody />
                    </QueryState.Data>
                  </QueryState>
                </SidebarSectionItem>
              ),
            )}
          </SortableGroup>
        </DragProvider>
      </OfflineOnce>
    </div>
  );
}
