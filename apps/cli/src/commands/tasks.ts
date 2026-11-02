import { Command, Option } from 'commander';
import type { Task, TaskStatus } from '../lib/api-types';
import { contextFor } from '../lib/context';
import { formatDate, render, style, table } from '../lib/output';
import { resolveProject } from '../lib/resolve';

const STATUSES = ['later', 'todo', 'doing', 'done'] as const;

/** Plan's tasks (`product/versions/mvp/17-plan.md`). */
export function tasksCommand(): Command {
  const tasks = new Command('tasks').description('Plan: the task board');

  tasks.addCommand(
    new Command('list')
      .alias('ls')
      .description('List tasks')
      .option('--project <project>', 'Only this project’s (name or id)')
      .addOption(new Option('--status <status>', 'Only tasks in this column').choices(STATUSES))
      .action(async function (this: Command) {
        const options = this.opts<{ project?: string; status?: TaskStatus }>();
        const context = contextFor(this);
        const projectId = options.project
          ? (await resolveProject(context.client, options.project)).id
          : undefined;
        const all = await context.client.get<Task[]>('/tasks', { query: { projectId } });
        const list = options.status ? all.filter((task) => task.status === options.status) : all;
        render(context.json, list, () =>
          table(
            list,
            [
              { header: 'ID', value: (task) => task.id },
              { header: 'STATUS', value: (task) => task.status },
              { header: 'TITLE', value: (task) => task.title },
              { header: 'DUE', value: (task) => task.dueDate ?? '—' },
              { header: 'SESSIONS', value: (task) => String(task.sessions.length) },
              { header: 'CREATED', value: (task) => formatDate(task.createdAt) },
            ],
            'No tasks.',
          ),
        );
      }),
  );

  tasks.addCommand(
    new Command('add')
      .description('Add a task')
      .argument('<title...>', 'What needs doing')
      .option('--project <project>', 'Project it belongs to (name or id)')
      .option('--notes <notes>', 'Notes')
      .addOption(new Option('--status <status>', 'Column').choices(STATUSES).default('todo'))
      .option('--due <YYYY-MM-DD>', 'Due date')
      .action(async function (this: Command, words: string[]) {
        const options = this.opts<{
          project?: string;
          notes?: string;
          status: TaskStatus;
          due?: string;
        }>();
        const context = contextFor(this);
        const projectId = options.project
          ? (await resolveProject(context.client, options.project)).id
          : undefined;
        const task = await context.client.post<Task>('/tasks', {
          body: {
            title: words.join(' '),
            notes: options.notes,
            status: options.status,
            projectId,
            dueDate: options.due,
          },
        });
        render(
          context.json,
          task,
          () => `${style.green('✓')} Added ${style.bold(task.title)} (${task.id}).`,
        );
      }),
  );

  tasks.addCommand(
    new Command('move')
      .description('Move a task to another column, at its top')
      .argument('<id>', 'Task id')
      .addOption(new Option('--to <status>', 'Column').choices(STATUSES).makeOptionMandatory())
      .action(async function (this: Command, id: string) {
        const { to } = this.opts<{ to: TaskStatus }>();
        const context = contextFor(this);
        const task = await context.client.post<Task>(`/tasks/${id}/move`, {
          body: { status: to, afterTaskId: null },
        });
        render(context.json, task, () => `${style.green('✓')} ${task.title} → ${task.status}.`);
      }),
  );

  return tasks;
}
