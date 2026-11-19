import {
  type BoardFilter,
  dueDayLabel,
  type MilestoneEntity,
  type ProjectEntity,
} from '@oppenheimer/frontend-consumer';
import { dateFormatter } from '@oppenheimer/frontend-core';

/**
 * What the shared `cardView` needs to word a task on the phone: the board's
 * filter, today, the project and milestone names (the Unassigned project
 * names none, since a row under it says nothing about where it is filed),
 * and a due day in words, as the console's card says it.
 */
export function cardContext({
  filter,
  today,
  locale,
  words,
  projects,
  milestones,
}: {
  filter: BoardFilter;
  today: string;
  locale: string;
  words: { today: string; tomorrow: string; yesterday: string };
  projects: readonly ProjectEntity[];
  milestones: readonly MilestoneEntity[];
}) {
  return {
    filter,
    today,
    projectName: (id: string) => {
      const project = projects.find((row) => row.id === id);
      return project && !project.isUnassigned ? project.name : null;
    },
    milestoneName: (id: string) => milestones.find((row) => row.id === id)?.name ?? null,
    dayLabel: (iso: string) =>
      dueDayLabel(iso, today, words, (day) =>
        dateFormatter(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
          new Date(`${day}T00:00:00Z`),
        ),
      ),
  };
}
