import { SearchableFacetMultiSelect, Skeleton } from '@oppenheimer/design-system-web';
import { Folder } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { UNASSIGNED_SLUG } from '../lib/project-scope';

/** The facet's first option: every project. */
const ALL = 'all';

/** The set pill's frame, for a pick whose names have not answered yet. */
const PENDING_FACET =
  'inline-flex h-7.5 shrink-0 items-center gap-1.75 rounded-pill bg-selected-surface px-3 text-selected-fg [&_svg]:size-3.25 [&_svg]:shrink-0';

interface FacetProject {
  id: string;
  slug: string;
  name: string;
  isUnassigned: boolean;
}

/**
 * The Project pill every view narrowed by `?project=` draws (Plan's board and
 * Milestones, the calendar): All projects, then each project by name, the
 * Unassigned one last as No project, several picks at once. `values` are the
 * slugs picked; while they are set and `projects` has not answered, the pill
 * stands lit with a bar for its name. `counts`, by project id, puts how many
 * each holds beside it (and `total` beside All projects).
 */
export function ProjectFacet({
  projects,
  values,
  onValuesChange,
  counts,
  total,
}: {
  projects: readonly FacetProject[] | undefined;
  values: readonly string[];
  onValuesChange: (slugs: string[]) => void;
  counts?: Readonly<Record<string, number>>;
  total?: number;
}) {
  const { t } = useTranslation();
  if (values.length && projects === undefined) {
    return (
      <span aria-hidden className={PENDING_FACET}>
        <Folder />
        <Skeleton shape="sm" className="h-2.5 w-16" />
      </span>
    );
  }
  const countOf = (id: string) => (counts ? (counts[id] ?? 0) : undefined);
  const unassigned = projects?.find((row) => row.isUnassigned);
  return (
    <SearchableFacetMultiSelect
      variant="pill"
      label={t('common.projectFilter.label')}
      icon={<Folder />}
      searchPlaceholder={t('common.search.projects')}
      emptyText={(query) => t('common.search.noMatch', { query })}
      values={values}
      onValuesChange={onValuesChange}
      options={[
        { value: ALL, label: t('common.projectFilter.all'), count: total },
        ...(projects ?? [])
          .filter((row) => !row.isUnassigned)
          .map((row) => ({ value: row.slug, label: row.name, count: countOf(row.id) })),
        ...(unassigned
          ? [
              {
                value: UNASSIGNED_SLUG,
                label: t('common.projectFilter.none'),
                count: countOf(unassigned.id),
              },
            ]
          : []),
      ]}
    />
  );
}
