import { Button, MilestoneGlyph, SearchableFacetSelect } from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { planCounts, UNASSIGNED_SLUG } from '../lib/plan-scope';

/** The facets' first option: nothing narrowed. */
const ALL = 'all';

/**
 * Plan's filter row (the 2026-10-13 `Tasks` frame): Project on the board and
 * on Milestones, Milestone on the board only, each with how many tasks it
 * holds, and Clear while either narrows the view. Both live in the address.
 */
export function PlanFilters({ milestone = false }: { milestone?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug, projectId } = useScopeProject();
  const milestoneId = useRouterState({
    select: (state) => {
      const value = (state.location.search as { milestone?: unknown }).milestone;
      return typeof value === 'string' ? value : undefined;
    },
  });
  const { data: projects } = useProjects();
  const { data: counts } = useTasks({ select: planCounts });
  const { data: milestones } = useMilestones({
    select: (rows) => rows.filter((row) => !projectId || row.projectId === projectId),
  });
  const unassigned = projects?.find((row) => row.isUnassigned);
  const set = (search: { project?: string; milestone?: string }) =>
    navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search }),
      replace: true,
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableFacetSelect
        variant="pill"
        label={t('tasks.filters.project')}
        icon={<Folder />}
        searchPlaceholder={t('common.search.projects')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        value={slug ?? ALL}
        onValueChange={(value) => {
          const project = value === ALL ? undefined : value;
          const picked = projects?.find((row) =>
            project === UNASSIGNED_SLUG ? row.isUnassigned : row.slug === project,
          );
          const keepMilestone =
            !project ||
            !milestoneId ||
            milestones?.some((row) => row.id === milestoneId && row.projectId === picked?.id);
          set({ project, milestone: keepMilestone ? milestoneId : undefined });
        }}
        options={[
          { value: ALL, label: t('tasks.filters.allProjects'), count: counts?.all },
          ...(projects ?? [])
            .filter((row) => !row.isUnassigned)
            .map((row) => ({
              value: row.slug,
              label: row.name,
              count: counts ? (counts.byProject[row.id] ?? 0) : undefined,
            })),
          ...(unassigned
            ? [
                {
                  value: UNASSIGNED_SLUG,
                  label: t('tasks.filters.noProject'),
                  count: counts ? (counts.byProject[unassigned.id] ?? 0) : undefined,
                },
              ]
            : []),
        ]}
      />
      {milestone ? (
        <SearchableFacetSelect
          variant="pill"
          label={t('tasks.filters.milestone')}
          icon={<MilestoneGlyph />}
          searchPlaceholder={t('common.search.milestones')}
          emptyText={(query) => t('common.search.noMatch', { query })}
          value={milestoneId ?? ALL}
          onValueChange={(value) => set({ milestone: value === ALL ? undefined : value })}
          options={[
            { value: ALL, label: t('tasks.filters.allMilestones') },
            ...(milestones ?? []).map((row) => ({
              value: row.id,
              label: row.name,
              count: counts ? (counts.byMilestone[row.id] ?? 0) : undefined,
            })),
          ]}
        />
      ) : null}
      {slug || (milestone && milestoneId) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => set({ project: undefined, milestone: undefined })}
        >
          {t('tasks.filters.clear')}
        </Button>
      ) : null}
    </div>
  );
}
