import { RoutineItem, SidebarListHead, useNow } from '@oppenheimer/design-system-web';
import {
  AlarmClock,
  Bot,
  CircleCheck,
  Flag,
  Folder,
  GitPullRequest,
  Inbox,
  Terminal,
} from '@oppenheimer/design-system-web/icons';
import { useInboxPullsShown, useSuspenseInbox } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useInboxSearch } from '@/features/inbox/hooks/use-inbox-search';
import { facetCounts } from '@/features/inbox/lib/inbox-filter';
import { type InboxTypeFilter, NO_PROJECT, typesFor } from '@/features/inbox/lib/inbox-search';

/** Each folder's glyph: the kind's own, as the cards wear it; All is the tray. */
const FOLDER_ICON: Record<InboxTypeFilter, ReactNode> = {
  all: <Inbox />,
  session: <Terminal />,
  bots: <Bot />,
  task: <CircleCheck />,
  report: <Flag />,
  run: <AlarmClock />,
  pull: <GitPullRequest />,
};

/**
 * The folders, read under the sidebar's Suspense: every kind with its count,
 * then every project that holds an item.
 */
export function InboxFolders() {
  const { t } = useTranslation();
  const now = useNow(60_000);
  // A refetch that fails is not drawn here: the list column beside it draws the same read's `error`.
  const inbox = useSuspenseInbox(now);
  const search = useInboxSearch();
  const [pullsShown] = useInboxPullsShown();
  const counts = facetCounts(inbox.open, search.filter);
  const projects = [
    ...inbox.projects
      .filter((project) => counts.projects.has(project.id))
      .map((project) => ({ id: project.id, name: project.name })),
    ...(counts.projects.has(NO_PROJECT) ? [{ id: NO_PROJECT, name: t('inbox.project.none') }] : []),
  ];

  return (
    <>
      <SidebarListHead label={t('inbox.folders.kinds')} />
      <div className="flex flex-col gap-0.5 px-3 pt-1 pb-3">
        {typesFor(pullsShown).map((type) => (
          <RoutineItem
            key={type}
            name={type === 'all' ? t('inbox.folders.all') : t(`inbox.type.${type}`)}
            icon={FOLDER_ICON[type]}
            meta={counts.types[type] ? String(counts.types[type]) : undefined}
            active={search.filter.type === type}
            nativeButton={false}
            render={
              <Link
                to="/inbox"
                search={(previous) => ({
                  ...previous,
                  type: type === 'all' ? undefined : type,
                  item: undefined,
                })}
              />
            }
          />
        ))}
      </div>
      {projects.length ? (
        <>
          <SidebarListHead label={t('inbox.folders.projects')} />
          <div className="flex flex-col gap-0.5 px-3 pt-1 pb-3">
            {projects.map((project) => {
              const active = search.filter.project === project.id;
              return (
                <RoutineItem
                  key={project.id}
                  name={project.name}
                  icon={<Folder />}
                  meta={String(counts.projects.get(project.id) ?? 0)}
                  active={active}
                  nativeButton={false}
                  render={
                    <Link
                      to="/inbox"
                      search={(previous) => ({
                        ...previous,
                        project: active ? undefined : project.id,
                        item: undefined,
                      })}
                    />
                  }
                />
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
