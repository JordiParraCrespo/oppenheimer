import {
  Skeleton,
  TaskBoard,
  TaskCardSkeleton,
  TaskColumn,
  TaskColumnAdd,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { TASK_STATUSES } from '@oppenheimer/shared/schemas/task';
import { useTranslation } from 'react-i18next';

/** Cards per column, as a board usually holds them: fuller on the left, thinner to the right. */
const CARDS = { todo: [0, 1], doing: [2, 3], review: [4], done: [5] } as const;

const NO_ITEMS: readonly string[] = [];

/**
 * The board before its first answer, on the board's own parts: the same
 * sideways scroller and columns, each with its status written, a bar where
 * its count goes, card placeholders on the card's frame and the Add task
 * foot, so the columns stand where they will and only the cards change. The
 * whole of it is inert until the tasks land.
 */
export function BoardSkeleton() {
  const { t } = useTranslation();
  return (
    <TaskBoard data-bleed aria-busy inert>
      <LoadingStatus />
      {TASK_STATUSES.map((status) => {
        const label = t(`tasks.columns.${status}`);
        return (
          <TaskColumn
            key={status}
            id={`skeleton-${status}`}
            status={status}
            label={label}
            count={<Skeleton shape="sm" className="inline-block h-2.5 w-3 align-middle" />}
            items={NO_ITEMS}
            onAdd={() => {}}
            addLabel={t('tasks.board.addTo', { column: label })}
            foot={<TaskColumnAdd disabled>{t('tasks.board.addTask')}</TaskColumnAdd>}
          >
            {CARDS[status].map((card) => (
              <TaskCardSkeleton key={card} index={card} />
            ))}
          </TaskColumn>
        );
      })}
    </TaskBoard>
  );
}
