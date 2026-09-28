import {
  Button,
  EmptyState,
  RoutineItem,
  SidebarEmptyRow,
  SidebarListHead,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import { useAutomations, useProjects } from '@oppenheimer/frontend-consumer/react';
import { combineQueries, QueryState, SidebarSearchField } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { AutomationGroup } from './automation-group';

/**
 * The console's sidebar body on its automations list
 * (`product/versions/mvp/13-automations.md`): New automation on top, the
 * Projects line with its count, the search, then All automations and a
 * folding header per project — each with New automation in it — over the
 * project's automations. The selected automation expands its last six runs,
 * each opening the session it started in the run view — the pane, with this
 * list kept beside it.
 *
 * What lives here is the two reads and what the groups share: the settled
 * search and the folded groups. The half-typed search is the search box's,
 * the minute clock is each group's, and which automation is selected is each
 * row's subscription to the route — so a keystroke, a tick or a navigation
 * does not redraw the list.
 *
 * The workspace's Unassigned project has no group: it holds the sessions
 * that name no project, and an automation is always set up for one.
 */
export function AutomationsSidebar() {
  const { t } = useTranslation();
  const projects = useProjects({ select: (rows) => rows.filter((row) => !row.isUnassigned) });
  const automations = useAutomations();
  const [closed, setClosed] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const dialogs = useConsoleDialog();
  // All automations is current on the overview and on the runs page.
  const all = useRouterState({
    select: (state) =>
      state.location.pathname === '/automations' || state.location.pathname === '/automations/runs',
  });

  const term = query.trim().toLowerCase();
  const groups = (projects.data ?? []).map((project) => ({
    project,
    items: (automations.data ?? []).filter(
      (automation) =>
        automation.projectId === project.id &&
        (!term ||
          automation.name.toLowerCase().includes(term) ||
          project.name.toLowerCase().includes(term)),
    ),
  }));
  const shown = term ? groups.filter((group) => group.items.length) : groups;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <Button size="sm" block onClick={() => dialogs.open({ kind: 'automation' })}>
          {t('automations.sidebar.new')}
        </Button>
      </div>

      <SidebarListHead label={t('automations.sidebar.projects')} count={projects.data?.length} />

      {automations.data?.length ? (
        <SidebarSearchField
          onChange={setQuery}
          label={t('automations.sidebar.search')}
          clearLabel={t('automations.sidebar.clearSearch')}
        />
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {term && !shown.length ? (
          <SidebarEmptyRow className="mt-2 ml-3.5">
            {t('automations.sidebar.noMatch', { query: query.trim() })}
          </SidebarEmptyRow>
        ) : null}
        {/* All is navigation, like New automation above it: it stays in
            every state, and its count shows only once the list has answered.
            The read's states are the project groups' below. */}
        <div className="px-3 pt-2">
          <RoutineItem
            name={t('automations.sidebar.all')}
            icon={<Zap />}
            meta={automations.data ? String(automations.data.length) : undefined}
            active={all}
            className="mb-1.5"
            render={<Link to="/automations" />}
          />
        </div>

        {/* A failed read is not "no projects": say it failed. */}
        <QueryState
          query={combineQueries(projects, automations, (rows) => ({ count: rows.length, shown }))}
          pending={
            <div className="flex flex-col gap-2 px-3 pt-2">
              <Skeleton className="h-7.5 w-full" />
              <Skeleton className="h-7.5 w-full" />
            </div>
          }
          errorFallback={t('automations.sidebar.loadFailed')}
          errorClassName="mx-3 mt-2"
          empty={{
            when: (ready) => ready.count === 0,
            show: (
              <div className="px-3 pt-2">
                <EmptyState compact>
                  <EmptyState.Header>
                    <EmptyState.Description>
                      {t('automations.sidebar.noProjects')}
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              </div>
            ),
          }}
        >
          {(ready) =>
            ready.shown.map(({ project, items }) => (
              <AutomationGroup
                key={project.id}
                project={project}
                items={items}
                open={Boolean(term) || !closed.includes(project.id)}
                onOpenChange={(next) =>
                  setClosed((current) =>
                    next ? current.filter((id) => id !== project.id) : [...current, project.id],
                  )
                }
                searching={Boolean(term)}
                onNew={(target) => dialogs.open({ kind: 'automation', projectId: target.id })}
              />
            ))
          }
        </QueryState>
      </div>
    </div>
  );
}
