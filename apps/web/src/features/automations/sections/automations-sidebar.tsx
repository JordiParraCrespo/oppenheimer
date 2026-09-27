import {
  Button,
  EmptyState,
  IconButton,
  RoutineItem,
  SidebarEmptyRow,
  SidebarProjectHeader,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Plus, Zap } from '@oppenheimer/design-system-web/icons';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The dialog loads when first opened: the sidebar is on every automations
 * route, and what it imports is that list's first load.
 */
const NewAutomationDialog = lazy(() =>
  import('../dialogs/new-automation').then((module) => ({ default: module.NewAutomationDialog })),
);

/**
 * The console's sidebar body on its automations list
 * (`product/versions/mvp/13-automations.md`): New automation on top, the
 * Projects line with its count, then All automations and a folding header
 * per project — each with New automation in it — over the project's
 * automations.
 *
 * The projects are read because the groups are theirs, all but the
 * workspace's Unassigned: it holds the sessions that name no project, and an
 * automation is set up for one, so it has no group here. Every group is
 * empty until the API behind automations lands, and the empty row says so.
 * The rows, the search that narrows them and the expanded runs under the
 * selected one arrive with that slice — a search with nothing to narrow is
 * not mounted.
 *
 * New automation, on top and in each group, opens the New automation dialog
 * over the console; a group's opens it for that project. Which one is open is
 * this sidebar's state, because its buttons are the only ones that open it
 * from here.
 */
export function AutomationsSidebar() {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const projects = useProjects();
  const named = projects.data?.filter((project) => !project.isUnassigned);
  const [closed, setClosed] = useState<string[]>([]);
  // The New automation dialog: `{}` from the top, `{ project }` from a group.
  const [creating, setCreating] = useState<{ project?: string } | null>(null);
  const all =
    Boolean(matchRoute({ to: '/automations' })) || Boolean(matchRoute({ to: '/automations/runs' }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pb-2.5">
        <Button size="sm" block onClick={() => setCreating({})}>
          {t('automations.sidebar.new')}
        </Button>
      </div>

      <div className="flex items-center gap-2 px-3 pt-0.5 pb-1.5">
        <span className="eyebrow min-w-0 flex-1">{t('automations.sidebar.projects')}</span>
        {named ? <span className="figures text-xs text-fg-muted">{named.length}</span> : null}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        <div className="px-3 pt-2">
          <RoutineItem
            name={t('automations.sidebar.all')}
            icon={<Zap />}
            active={all}
            className="mb-1.5"
            render={<Link to="/automations" />}
          />
        </div>

        {projects.isPending ? (
          <div className="flex flex-col gap-2 px-3 pt-2">
            <Skeleton className="h-7.5 w-full" />
            <Skeleton className="h-7.5 w-full" />
          </div>
        ) : named?.length ? (
          named.map((project) => {
            const open = !closed.includes(project.id);
            return (
              <div key={project.id} className="mt-1.5 flex flex-col">
                <SidebarProjectHeader
                  name={project.name}
                  count={0}
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
                      onClick={() => setCreating({ project: project.id })}
                    >
                      <Plus />
                    </IconButton>
                  }
                />
                {open ? (
                  <SidebarEmptyRow>
                    {t('automations.sidebar.emptyProject')}{' '}
                    <button type="button" onClick={() => setCreating({ project: project.id })}>
                      {t('automations.sidebar.createOne')}
                    </button>
                  </SidebarEmptyRow>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="px-3 pt-2">
            <EmptyState compact>
              <EmptyState.Header>
                <EmptyState.Description>
                  {t('automations.sidebar.noProjects')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        {creating ? (
          <NewAutomationDialog project={creating.project} onClose={() => setCreating(null)} />
        ) : null}
      </Suspense>
    </div>
  );
}
