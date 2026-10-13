import { FacetSelect, MilestoneGlyph } from '@oppenheimer/design-system-web';
import { useMilestones } from '@oppenheimer/frontend-consumer/react';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useBoardFilter } from '../hooks/use-board-filter';

const board = getRouteApi('/_authenticated/plan/');

/** No milestone chosen: the facet's first option. */
const ANY = 'any';

/**
 * The board's milestone facet (the 2026-10-13 frame): Any milestone, or one of
 * the milestones of the project shown, with how many tasks each holds. It
 * draws nothing while there are none to pick.
 */
export function BoardMilestoneFilter() {
  const { t } = useTranslation();
  const filter = useBoardFilter();
  const navigate = board.useNavigate();
  const { data: milestones } = useMilestones({
    select: (rows) =>
      rows.filter((milestone) => !filter.projectId || milestone.projectId === filter.projectId),
  });
  if (!milestones?.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FacetSelect
        variant="pill"
        label={t('tasks.filters.milestone')}
        icon={<MilestoneGlyph />}
        value={filter.milestoneId ?? ANY}
        onValueChange={(value) =>
          navigate({
            search: (previous) => ({ ...previous, milestone: value === ANY ? undefined : value }),
            replace: true,
          })
        }
        options={[
          { value: ANY, label: t('tasks.filters.anyMilestone') },
          ...milestones.map((milestone) => ({
            value: milestone.id,
            label: milestone.name,
            count: milestone.totalCount,
          })),
        ]}
      />
    </div>
  );
}
