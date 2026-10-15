import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { ProjectPlanSummary } from '@oppenheimer/shared/plan';
import { ProjectEntity } from '../../../projects/domain/project.entity';
import { FindProjectsQuery } from '../../../projects/queries/find-projects/find-projects.query';
import { CreateTaskCommand } from '../../../tasks/commands/create-task/create-task.command';
import { MoveTaskCommand } from '../../../tasks/commands/move-task/move-task.command';
import { UpdateTaskCommand } from '../../../tasks/commands/update-task/update-task.command';
import { TaskEntity, type TaskProps } from '../../../tasks/domain/task.entity';
import { FindPlanSummaryQuery } from '../../../tasks/queries/find-plan-summary/find-plan-summary.query';
import { FindTaskQuery } from '../../../tasks/queries/find-task/find-task.query';
import { FindTasksQuery } from '../../../tasks/queries/find-tasks/find-tasks.query';
import { BotPlanToolsFactory } from '../bot-plan-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The project and plan tools a bot reads and writes through: each dispatches
 * the projects' or tasks' own query or command in the owner's scope, every
 * write names the bot as an agent acting for the owner, and a write is read
 * back so the answer says where the task ended up. Bad input comes back as an
 * error the model can correct with nothing dispatched. The queries and
 * commands themselves are their modules' specs.
 */
const owner = emptyScope('owner-1', 'org-1');
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: '99999999-9999-4999-8999-999999999999',
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'Europe/Madrid',
};

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MILESTONE_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_TASK_ID = '44444444-4444-4444-8444-444444444444';

function setup(answers: { query?: (query: unknown) => unknown; command?: () => unknown }) {
  const queryBus = { execute: vi.fn(async (query: unknown) => answers.query?.(query)) };
  const commandBus = { execute: vi.fn(async () => answers.command?.()) };
  const factory = new BotPlanToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
  );
  const call = (name: string, input: unknown) => {
    const found = factory.definitions().find((definition) => definition.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { queryBus, commandBus, call };
}

const task = (props: Partial<TaskProps> & { id?: string } = {}) =>
  TaskEntity.create({
    id: props.id ?? TASK_ID,
    props: {
      organizationId: 'org-1',
      projectId: PROJECT_ID,
      milestoneId: null,
      status: 'todo',
      rank: 'm',
      title: 'Write the release notes',
      notes: '',
      dueDate: null,
      dueTime: null,
      completedAt: null,
      blockedReason: null,
      blockedAt: null,
      version: 3,
      idempotencyKey: null,
      createdByUserId: 'owner-1',
      sessions: [],
      ...props,
    },
    updatedAt: new Date('2026-10-15T08:00:00Z'),
  });

const project = (name: string) =>
  ProjectEntity.create({
    id: PROJECT_ID,
    props: {
      organizationId: 'org-1',
      name,
      slug: 'website',
      archivedAt: null,
      createdByUserId: 'owner-1',
      repositories: [
        {
          installationId: 'inst-1',
          githubRepoId: '1',
          repositoryFullName: 'acme/website',
          baseBranch: 'main',
          isDefault: true,
        },
      ],
      defaultHostId: null,
      defaultAgent: 'claude',
      isUnassigned: false,
    },
  });

describe('BotPlanToolsFactory', () => {
  it('lists the owner’s tasks in a column, with their versions, and says how many were left out', async () => {
    const { queryBus, call } = setup({
      query: () => [
        task({ status: 'doing', blockedReason: 'Needs the copy approved' }),
        task({ id: OTHER_TASK_ID, status: 'doing', dueDate: '2026-10-20', dueTime: '09:30' }),
        task({ id: MILESTONE_ID, status: 'done' }),
      ],
    });

    const result = await call('list_tasks', { project_id: PROJECT_ID, status: 'doing', limit: 1 });

    const query = queryBus.execute.mock.calls[0][0] as FindTasksQuery;
    expect(query).toBeInstanceOf(FindTasksQuery);
    expect(query.scope).toBe(owner);
    expect(query.filter).toMatchObject({ projectId: PROJECT_ID });
    expect(result.content).toContain(
      `${TASK_ID} "Write the release notes" [In progress; v3; project ${PROJECT_ID}; milestone none; no due date; blocked: Needs the copy approved]`,
    );
    expect(result.content).not.toContain(OTHER_TASK_ID);
    expect(result.content).toContain('(1 of 2 shown.');
  });

  it('says in words that no task matches, rather than an empty list', async () => {
    const { call } = setup({ query: () => [] });
    expect((await call('list_tasks', {})).content).toBe('No tasks match.');
  });

  it('creates a task as the bot acting for its owner, and reports the column it landed in', async () => {
    const { queryBus, commandBus, call } = setup({
      command: () => TASK_ID,
      query: () => task({ milestoneId: MILESTONE_ID, dueDate: '2026-10-20' }),
    });

    const result = await call('create_task', {
      title: '  Write the release notes ',
      project_id: PROJECT_ID,
      milestone_id: MILESTONE_ID,
      due_date: '2026-10-20',
    });

    const command = commandBus.execute.mock.calls[0][0] as CreateTaskCommand;
    expect(command).toBeInstanceOf(CreateTaskCommand);
    expect(command).toMatchObject({
      scope: owner,
      userId: 'owner-1',
      actor: { type: 'agent', userId: 'owner-1', agentId: context.botId },
      input: {
        title: 'Write the release notes',
        status: 'todo',
        projectId: PROJECT_ID,
        milestoneId: MILESTONE_ID,
        dueDate: '2026-10-20',
      },
    });
    const readBack = queryBus.execute.mock.calls[0][0] as FindTaskQuery;
    expect(readBack).toBeInstanceOf(FindTaskQuery);
    expect(readBack).toMatchObject({ scope: owner, taskId: TASK_ID });
    expect(result.content).toMatch(
      new RegExp(`^Created task ${TASK_ID} "Write the release notes" in To do\\.`),
    );
    expect(result.content).toContain(`- milestone: ${MILESTONE_ID}`);
  });

  it('refuses a due time with no due day, creating nothing', async () => {
    const { commandBus, call } = setup({});
    const result = await call('create_task', { title: 'Ship it', due_time: '09:00' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('due_time');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('edits only the fields passed, unblocking with null, conditioned on the version the bot read', async () => {
    const { commandBus, call } = setup({
      command: () => TASK_ID,
      query: () => task({ version: 4, title: 'Release notes v2' }),
    });

    const result = await call('update_task', {
      task_id: TASK_ID,
      expected_version: 3,
      title: 'Release notes v2',
      blocked_reason: null,
    });

    const command = commandBus.execute.mock.calls[0][0] as UpdateTaskCommand;
    expect(command).toBeInstanceOf(UpdateTaskCommand);
    expect(command.scope).toBe(owner);
    expect(command.actor).toEqual({ type: 'agent', userId: 'owner-1', agentId: context.botId });
    expect(command.taskId).toBe(TASK_ID);
    expect(command.changes).toEqual({
      title: 'Release notes v2',
      blockedReason: null,
      expectedVersion: 3,
      notes: undefined,
      projectId: undefined,
      milestoneId: undefined,
      dueDate: undefined,
      dueTime: undefined,
    });
    expect(result.content).toMatch(/^Updated task .+ "Release notes v2", now at v4\./);
  });

  it('refuses an edit that changes nothing or names no version, dispatching nothing', async () => {
    const { commandBus, call } = setup({});
    const empty = await call('update_task', { task_id: TASK_ID, expected_version: 3 });
    const unversioned = await call('update_task', { task_id: TASK_ID, title: 'New' });
    expect(empty.isError).toBe(true);
    expect(empty.content).toContain('nothing to change');
    expect(unversioned.isError).toBe(true);
    expect(unversioned.content).toContain('expected_version');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('moves a task first in its column when no task is named to follow', async () => {
    const { commandBus, call } = setup({
      command: () => TASK_ID,
      query: () => task({ status: 'done', version: 4 }),
    });

    const result = await call('move_task', {
      task_id: TASK_ID,
      status: 'done',
      expected_version: 3,
    });

    const command = commandBus.execute.mock.calls[0][0] as MoveTaskCommand;
    expect(command).toBeInstanceOf(MoveTaskCommand);
    expect(command).toMatchObject({
      scope: owner,
      actor: { type: 'agent', agentId: context.botId },
      taskId: TASK_ID,
      move: { status: 'done', afterTaskId: null, expectedVersion: 3 },
    });
    expect(result.content).toBe(
      `Moved task ${TASK_ID} "Write the release notes" to Done (first), now at v4.`,
    );
  });

  it('reads a version conflict back as its code, so the bot knows to re-read', async () => {
    const { call } = setup({
      command: () => {
        throw new AppError(
          { code: 'TASKS_008', message: 'Task changed since it was read', httpStatus: 409 },
          { detail: `Task ${TASK_ID} is no longer at version 3` },
        );
      },
    });
    const result = await call('move_task', {
      task_id: TASK_ID,
      status: 'doing',
      after_task_id: OTHER_TASK_ID,
      expected_version: 3,
    });
    expect(result).toEqual({
      content: `TASKS_008: Task changed since it was read. Task ${TASK_ID} is no longer at version 3`,
      isError: true,
    });
  });

  it('summarizes the plan for the sender’s calendar day, naming each project', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 23:30 UTC on the 15th is already the 16th in Madrid.
    vi.setSystemTime(new Date('2026-10-15T23:30:00Z'));
    const summary: ProjectPlanSummary = {
      projectId: PROJECT_ID,
      done: 1,
      total: 3,
      doing: [{ taskId: TASK_ID, title: 'Write the release notes', dueDate: null }],
      needsInput: [
        { taskId: OTHER_TASK_ID, title: 'Pick a date', reason: 'overdue', detail: '2026-10-14' },
      ],
      nextDue: { taskId: OTHER_TASK_ID, title: 'Pick a date', dueDate: '2026-10-14' },
      nextMilestone: null,
      milestones: [
        {
          milestoneId: MILESTONE_ID,
          name: 'Launch',
          targetDate: '2026-11-01',
          done: 1,
          total: 2,
          completed: false,
        },
      ],
      status: 'needs_input',
    };
    const { queryBus, call } = setup({
      query: (query) => (query instanceof FindProjectsQuery ? [project('Website')] : [summary]),
    });

    try {
      const result = await call('plan_summary', {});

      const asked = queryBus.execute.mock.calls
        .map(([query]: unknown[]) => query)
        .find((query: unknown) => query instanceof FindPlanSummaryQuery) as FindPlanSummaryQuery;
      expect(asked).toMatchObject({ scope: owner, today: '2026-10-16' });
      expect(result.content).toContain('Plan: 1 of 3 tasks done, 1 in progress, 1 need the person');
      expect(result.content).toContain(
        `Project ${PROJECT_ID} "Website": needs input, 1 of 3 tasks done`,
      );
      expect(result.content).toContain(`${OTHER_TASK_ID} "Pick a date" overdue since 2026-10-14`);
      expect(result.content).toContain(`${MILESTONE_ID} "Launch" 1 of 2 done; target 2026-11-01`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says in words that the plan is empty', async () => {
    const { call } = setup({ query: () => [] });
    expect((await call('plan_summary', {})).content).toContain('The plan is empty');
  });

  it('reads one project with its repositories, the default marked', async () => {
    const { call } = setup({ query: () => project('Website') });
    const result = await call('get_project', { project_id: PROJECT_ID });
    expect(result.content).toContain(`Project ${PROJECT_ID} "Website"`);
    expect(result.content).toContain('- acme/website (base main) default');
    expect(result.content).toContain('- default agent: claude');
  });

  it('answers a project id that is not a uuid as bad input, reading nothing', async () => {
    const { queryBus, call } = setup({});
    const result = await call('get_project', { project_id: 'website' });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/^Invalid input: project_id/);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
