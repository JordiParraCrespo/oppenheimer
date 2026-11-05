import {
  Button,
  MilestoneGlyph,
  SearchableFacetMultiSelect,
  SearchableFacetSelect,
} from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { rememberPlanFilters } from '../lib/plan-filter-memory';
import { planCounts, projectParamOf, UNASSIGNED_SLUG } from '../lib/plan-scope';

/** The facets' first option: nothing narrowed. */
const ALL = 'all';

/**
 * Plan's filter row (the 2026-10-13 `Tasks` frame): Project on the board and
 * on Milestones, Milestone on the board only, each with how many tasks it
 * holds, and Clear while either narrows the view. Both live in the address.
 * Project takes several picks (`?project=web,billing`); a milestone stays
 * picked while its project is one of them. Each pick is remembered on this
 * device, so the view comes back filtered (or cleared) the way it was left.
 */
export function PlanFilters({ milestone = false }: { milestone?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slugs, projectIds } = useScopeProject();
  const milestoneId = useRouterState({
    select: (state) => {
      const value = (state.location.search as { milestone?: unknown }).milestone;
      return typeof value === 'string' ? value : undefined;
    },
  });
  const { data: projects } = useProjects();
  const { data: counts } = useTasks({ select: planCounts });
  const { data: milestones } = useMilestones({
    select: (rows) => rows.filter((row) => !projectIds || projectIds.includes(row.projectId)),
  });
  const unassigned = projects?.find((row) => row.isUnassigned);
  const set = (search: { project?: string; milestone?: string }) => {
    // Remembered before the address moves: the route restores a remembered
    // filter into an address without one, and a Clear must not be undone.
    rememberPlanFilters(milestone ? 'board' : 'milestones', {
      project: slugs.length ? projectParamOf(slugs) : undefined,
      milestone: milestoneId,
      ...search,
    });
    return navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search }),
      replace: true,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableFacetMultiSelect
        variant="pill"
        label={t('tasks.filters.project')}
        icon={<Folder />}
        searchPlaceholder={t('common.search.projects')}
        emptyText={(query) => t('common.search.noMatch', { query })}
        values={slugs}
        onValuesChange={(next) => {
          const picked = new Set(
            (projects ?? [])
              .filter((row) => next.includes(row.isUnassigned ? UNASSIGNED_SLUG : row.slug))
              .map((row) => row.id),
          );
          const keepMilestone =
            next.length === 0 ||
            !milestoneId ||
            milestones?.some((row) => row.id === milestoneId && picked.has(row.projectId));
          set({
            project: projectParamOf(next),
            milestone: keepMilestone ? milestoneId : undefined,
          });
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
      {slugs.length || (milestone && milestoneId) ? (
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
