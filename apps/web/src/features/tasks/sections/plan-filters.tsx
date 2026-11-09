import {
  Button,
  MilestoneGlyph,
  SearchableFacetMultiSelect,
  SearchableFacetSelect,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useMilestones, useProjects, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useScopeProject } from '../hooks/use-scope-project';
import { type PlanFilterView, rememberPlanFilters } from '../lib/plan-filter-memory';
import { planCounts, projectParamOf, UNASSIGNED_SLUG } from '../lib/plan-scope';

/** The facets' first option: nothing narrowed. */
const ALL = 'all';

/** A set `pill` facet's frame, for a pick whose name has not answered yet. */
const PENDING_FACET =
  'inline-flex h-7.5 shrink-0 items-center gap-1.75 rounded-pill bg-selected-surface px-3 text-selected-fg [&_svg]:size-3.25 [&_svg]:shrink-0';

/**
 * Plan's filter row (the 2026-10-13 `Tasks` frame): Project on the board and
 * on Milestones, Milestone on the board only, each with how many tasks it
 * holds, and Clear while either narrows the view. Both live in the address.
 * Project takes several picks (`?project=web,billing`); a milestone stays
 * picked while its project is one of them. Each pick is remembered on this
 * device, so the view comes back filtered (or cleared) the way it was left.
 */
export function PlanFilters({ view }: { view: PlanFilterView }) {
  // Only the board narrows by milestone.
  const showsMilestone = view === 'board';
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
    rememberPlanFilters(view, {
      project: projectParamOf(slugs),
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
      {/* A pick in the address before its names answer: the facet set, its value a bar, not the bare "Project". */}
      {slugs.length && projects === undefined ? (
        <span aria-hidden className={PENDING_FACET}>
          <Folder />
          <Skeleton shape="sm" className="h-2.5 w-16" />
        </span>
      ) : (
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
      )}
      {showsMilestone && milestoneId && milestones === undefined ? (
        <span aria-hidden className={PENDING_FACET}>
          <MilestoneGlyph />
          <Skeleton shape="sm" className="h-2.5 w-20" />
        </span>
      ) : showsMilestone ? (
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
      {slugs.length || (showsMilestone && milestoneId) ? (
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
