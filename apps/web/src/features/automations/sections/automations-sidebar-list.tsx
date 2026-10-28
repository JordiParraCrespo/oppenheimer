import {
  EmptyState,
  RoutineItem,
  SidebarEmptyRow,
  SidebarListHead,
} from '@oppenheimer/design-system-web';
import { Zap } from '@oppenheimer/design-system-web/icons';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseAutomationsByProject } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, SidebarSearchField } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { AutomationGroup } from './automation-group';

/**
 * The automations sidebar below New automation, in `AutomationsSidebar`'s
 * `QueryState.Data`: the projects head, the search, All, and a group per
 * project. It reads the projects and the automations under Suspense, side by
 * side, and holds what the groups share (the settled search, the folded
 * groups); the half-typed search, the minute clock and each row's route
 * subscription live lower, so a keystroke, a tick or a navigation does not
 * redraw the list. Only a project with an automation has a group, and the
 * head counts those; the workspace's Unassigned project never does, since an
 * automation is always set up for a named one.
 * A refetch that fails keeps the groups and says so above them.
 */
export function AutomationsSidebarList() {
  const { t } = useTranslation();
  const { automations, projects: everyProject, error } = useSuspenseAutomationsByProject();
  const named = everyProject.filter((row) => !row.isUnassigned);
  const owned = new Map<string, AutomationEntity[]>();
  for (const automation of automations) {
    const items = owned.get(automation.projectId);
    if (items) items.push(automation);
    else owned.set(automation.projectId, [automation]);
  }
  const projects = named.filter((project) => owned.has(project.id));
  const [closed, setClosed] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const dialogs = useConsoleDialog();
  const all = useRouterState({
    select: (state) =>
      state.location.pathname === '/automations' || state.location.pathname === '/automations/runs',
  });

  const term = query.trim().toLowerCase();
  const groups = projects.map((project) => ({
    project,
    items: (owned.get(project.id) ?? []).filter(
      (automation) =>
        !term ||
        automation.name.toLowerCase().includes(term) ||
        project.name.toLowerCase().includes(term),
    ),
  }));
  const shown = term ? groups.filter((group) => group.items.length) : groups;

  return (
    <>
      <SidebarListHead label={t('automations.sidebar.projects')} count={projects.length} />

      {automations.length ? (
        <SidebarSearchField
          onChange={setQuery}
          label={t('automations.sidebar.search')}
          clearLabel={t('automations.sidebar.clearSearch')}
        />
      ) : null}

      <ErrorAlert
        error={error}
        fallback={t('automations.sidebar.loadFailed')}
        className="mx-3 mb-2"
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {term && !shown.length ? (
          <SidebarEmptyRow className="mt-2 ml-3.5">
            {t('automations.sidebar.noMatch', { query: query.trim() })}
          </SidebarEmptyRow>
        ) : null}
        {/* All is navigation, like New automation above it: the boundary's
            placeholder draws it too, with no count until the list answers. */}
        <div className="px-3 pt-2">
          <RoutineItem
            name={t('automations.sidebar.all')}
            icon={<Zap />}
            meta={String(automations.length)}
            active={all}
            className="mb-1.5"
            render={<Link to="/automations" />}
          />
        </div>

        {projects.length === 0 ? (
          <div className="px-3 pt-2">
            <EmptyState compact>
              <EmptyState.Header>
                <EmptyState.Description>
                  {t(
                    named.length
                      ? 'automations.sidebar.noAutomations'
                      : 'automations.sidebar.noProjects',
                  )}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        ) : (
          shown.map(({ project, items }) => (
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
              onNew={(target) => dialogs.open({ kind: 'automation', projectId: target.id })}
            />
          ))
        )}
      </div>
    </>
  );
}
