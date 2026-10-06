import type { TaskStatus } from '@oppenheimer/design-system-web/task-board';

/**
 * What the Plan demos share. The page is prerendered, so "today" is a fixed
 * day rather than a clock: the demos read the same on the server and in the
 * browser.
 */
export const TODAY = '2026-10-05';

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'later', label: 'Later' },
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
];
