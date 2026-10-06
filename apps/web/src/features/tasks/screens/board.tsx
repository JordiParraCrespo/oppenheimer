import { getRouteApi } from '@tanstack/react-router';
import { StartSessionDialog } from '../dialogs/start-session';
import { TaskDialog } from '../dialogs/task';
import { useNewTaskShortcut } from '../hooks/use-new-task-shortcut';
import { NEW_TASK } from '../lib/board-search';
import { BoardColumns } from '../sections/board-columns';
import { BoardHeader } from '../sections/board-header';
import { GoalsStrip } from '../sections/goals-strip';

const board = getRouteApi('/_authenticated/plan/');

/**
 * Plan's board (`product/versions/mvp/18-plan-product.md` §2): the header,
 * the goals strip and the four columns, and the two dialogs the address opens.
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
      <GoalsStrip />
      <BoardColumns />
      <TaskDialog />
      <StartSessionDialog />
    </div>
  );
}
