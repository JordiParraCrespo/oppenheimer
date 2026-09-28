import {
  Button,
  EmptyState,
  IconButton,
  RoutineItem,
  RoutineRun,
  RoutineRunList,
  RoutineRunsEmpty,
  SessionList,
  SidebarEmptyRow,
  SidebarListHead,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SidebarSearch,
  Skeleton,
  useNow,
} from '@oppenheimer/design-system-web';
import { Plus, Zap } from '@oppenheimer/design-system-web/icons';
import { useAutomations, useProjects } from '@oppenheimer/frontend-consumer/react';
import { combineQueries, formatAge, QueryState, useConsoleDialog } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriggerGlyph } from '../components/trigger-glyph';
import { runState, sidebarMeta } from '../lib/automation-view';

/**
 * The console's sidebar body on its automations list
 * (`product/versions/mvp/13-automations.md`): New automation on top, the
 * Projects line with its count, the search, then All automations and a
 * folding header per project — each with New automation in it — over the
 * project's automations. The selected automation expands its last six runs,
 * each opening the session it started in the run view — the pane, with this
 * list kept beside it.
 *
 * The workspace's Unassigned project has no group: it holds the sessions
 * that name no project, and an automation is always set up for one.
 */
export function AutomationsSidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const projects = useProjects({ select: (rows) => rows.filter((row) => !row.isUnassigned) });
  const automations = useAutomations();
  const [closed, setClosed] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const dialogs = useConsoleDialog();
  const now = useNow(60_000);

  // The selected automation is the page's, or the run's whose session is open.
  const detail = matchRoute({ to: '/automations/$automationId' });
  const runView = matchRoute({ to: '/automations/$automationId/sessions/$sessionId' });
  const selectedId = runView ? runView.automationId : detail ? detail.automationId : null;
  const openSessionId = runView ? runView.sessionId : null;
  const all =
    Boolean(matchRoute({ to: '/automations' })) || Boolean(matchRoute({ to: '/automations/runs' }));

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
        <SidebarSearch
          value={query}
          onValueChange={setQuery}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('');
          }}
          aria-label={t('automations.sidebar.search')}
          placeholder={t('automations.sidebar.search')}
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
            ready.shown.map(({ project, items }) => {
              const open = Boolean(term) || !closed.includes(project.id);
              return (
                <SidebarProjectGroup key={project.id}>
                  <SidebarProjectHeader
                    name={project.name}
                    count={items.length}
                    open={open}
                    onOpenChange={(next) =>
                      setClosed((current) =>
                        next ? current.filter((id) => id !== project.id) : [...current, project.id],
                      )
                    }
                    actions={
                      <IconButton
                        size="xs"
                        variant="quiet"
                        aria-label={t('automations.sidebar.newHere', { name: project.name })}
                        onClick={() => dialogs.open({ kind: 'automation', projectId: project.id })}
                      >
                        <Plus />
                      </IconButton>
                    }
                  />
                  {open && items.length ? (
                    <SessionList>
                      {items.map((automation) => {
                        const selected = automation.id === selectedId;
                        return (
                          <Fragment key={automation.id}>
                            <RoutineItem
                              name={automation.name}
                              icon={<TriggerGlyph scheduled={automation.isScheduled} />}
                              meta={sidebarMeta(automation, now, t)}
                              running={automation.isRunning}
                              paused={automation.isPaused}
                              active={selected}
                              render={
                                <Link
                                  to="/automations/$automationId"
                                  params={{ automationId: automation.id }}
                                />
                              }
                            />
                            {selected ? (
                              <RoutineRunList>
                                {automation.lastRuns.length ? (
                                  automation.lastRuns.map((run) => (
                                    <RoutineRun
                                      key={run.id}
                                      title={run.title}
                                      ago={formatAge(run.createdAt, now, t)}
                                      state={runState(run.status)}
                                      disabled={!run.sessionId}
                                      active={
                                        Boolean(run.sessionId) && run.sessionId === openSessionId
                                      }
                                      render={
                                        run.sessionId ? (
                                          <Link
                                            to="/automations/$automationId/sessions/$sessionId"
                                            params={{
                                              automationId: automation.id,
                                              sessionId: run.sessionId,
                                            }}
                                          />
                                        ) : undefined
                                      }
                                    />
                                  ))
                                ) : (
                                  <RoutineRunsEmpty>
                                    {t('automations.sidebar.noRuns')}
                                  </RoutineRunsEmpty>
                                )}
                              </RoutineRunList>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </SessionList>
                  ) : null}
                  {open && !items.length && !term ? (
                    <SidebarEmptyRow>
                      {t('automations.sidebar.emptyProject')}{' '}
                      <button
                        type="button"
                        onClick={() => dialogs.open({ kind: 'automation', projectId: project.id })}
                      >
                        {t('automations.sidebar.createOne')}
                      </button>
                    </SidebarEmptyRow>
                  ) : null}
                </SidebarProjectGroup>
              );
            })
          }
        </QueryState>
      </div>
    </div>
  );
}
