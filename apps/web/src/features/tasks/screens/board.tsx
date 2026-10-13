import { getRouteApi } from '@tanstack/react-router';
import { StartSessionDialog } from '../dialogs/start-session';
import { TaskDialog } from '../dialogs/task';
import { useNewTaskShortcut } from '../hooks/use-new-task-shortcut';
import { NEW_TASK } from '../lib/board-search';
import { BoardColumns } from '../sections/board-columns';
import { BoardHeader } from '../sections/board-header';
import { PlanFilters } from '../sections/plan-filters';

const board = getRouteApi('/_authenticated/plan/');

/**
 * Plan's board (the 2026-10-13 `Tasks` frame): the header, the Project and
 * Milestone filters, the four columns, and the two dialogs the address opens.
 * Each part reads what it draws; this screen only lays them out.
 */
export function BoardScreen() {
  const navigate = board.useNavigate();
  const openNew = () => navigate({ search: (previous) => ({ ...previous, task: NEW_TASK }) });
  useNewTaskShortcut(openNew);

  return (
    // The page is the shell's (`plan.tsx` declares its measure); the board's
    // scroller reaches through its gutter on its own.
    <div className="flex flex-col gap-7">
      <BoardHeader onNew={openNew} />
      <PlanFilters milestone />
      <BoardColumns />
      <TaskDialog />
      <StartSessionDialog />
    </div>
  );
}
