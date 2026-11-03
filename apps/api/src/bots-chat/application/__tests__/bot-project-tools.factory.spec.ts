import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { ArchiveProjectCommand } from '../../../projects/commands/archive-project/archive-project.command';
import { CreateProjectCommand } from '../../../projects/commands/create-project/create-project.command';
import { UpdateProjectCommand } from '../../../projects/commands/update-project/update-project.command';
import { ProjectEntity, type ProjectProps } from '../../../projects/domain/project.entity';
import { ProjectErrors } from '../../../projects/domain/projects.errors';
import { FindProjectQuery } from '../../../projects/queries/find-project/find-project.query';
import { FindProjectsQuery } from '../../../projects/queries/find-projects/find-projects.query';
import { MoveSessionCommand } from '../../../sessions/commands/move-session/move-session.command';
import { SessionErrors } from '../../../sessions/domain/sessions.errors';
import type { WorkSessionEntity } from '../../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../../sessions/queries/find-session/find-session.query';
import { FindSessionsQuery } from '../../../sessions/queries/find-sessions/find-sessions.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotProjectToolsFactory } from '../bot-project-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * How a bot manages projects (issue #647): it makes, changes and archives
 * them, and moves an existing session between them, through the projects'
 * and sessions' own commands in the owner's scope and through the schemas
 * the console's routes validate with. What it must never do: make a second
 * project under a name the person already uses, archive without the person
 * saying yes (under any preset), file a session under a project the owner's
 * workspace does not hold or an archived one, or touch anything but the
 * session's project when it moves one. The commands' own rules (scoping,
 * the archive's lock, the move's log entry) are their modules' specs.
 */
const owner = emptyScope('owner-1', 'org-1');

const contextOf = (permission: 'auto' | 'full'): BotToolContext => ({
  owner,
  organizationId: 'org-1',
  botId: '99999999-9999-4999-8999-999999999999',
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'Europe/Madrid',
  permission,
  permissions: NO_PERMISSIONS,
  budget: new BotTurnBudget(),
  credentialScopes: null,
  approvals: {
    request: vi.fn(async () => ({ status: 'requested' as const, approvalId: 'approval-1' })),
  },
});

const SEO_ID = '11111111-1111-4111-8111-111111111111';
const WEBSITE_ID = '22222222-2222-4222-8222-222222222222';
const UNASSIGNED_ID = '33333333-3333-4333-8333-333333333333';
const ARCHIVED_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_WORKSPACE_PROJECT_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '66666666-6666-4666-8666-666666666666';
const INSTALLATION_ID = '77777777-7777-4777-8777-777777777777';

const project = (id: string, name: string, props: Partial<ProjectProps> = {}) =>
  ProjectEntity.create({
    id,
    props: {
      organizationId: 'org-1',
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      archivedAt: null,
      createdByUserId: 'owner-1',
      repositories: [],
      defaultHostId: null,
      defaultAgent: null,
      isUnassigned: false,
      ...props,
    },
  });

const WORKSPACE = [
  project(WEBSITE_ID, 'Website'),
  project(UNASSIGNED_ID, 'Unassigned', { isUnassigned: true }),
  project(ARCHIVED_ID, 'Old site', { archivedAt: new Date('2026-09-01T00:00:00Z') }),
];

/** A session as the tools read it: only its id, name, project and state. */
const session = (props: { projectId?: string; state?: string; id?: string } = {}) =>
  ({
    id: props.id ?? SESSION_ID,
    name: 'Fix the sitemap',
    projectId: props.projectId ?? WEBSITE_ID,
    state: props.state ?? 'open',
  }) as unknown as WorkSessionEntity;

function setup(
  answers: { query?: (query: unknown) => unknown; command?: (command: unknown) => unknown } = {},
  permission: 'auto' | 'full' = 'auto',
) {
  const queryBus = {
    execute: vi.fn(async (query: unknown) => {
      if (answers.query) return answers.query(query);
      if (query instanceof FindProjectsQuery) return WORKSPACE;
      return undefined;
    }),
  };
  const commandBus = { execute: vi.fn(async (command: unknown) => answers.command?.(command)) };
  const factory = new BotProjectToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
  );
  const context = contextOf(permission);
  const definition = (name: string) => {
    const found = factory.definitions().find((candidate) => candidate.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found;
  };
  const call = (name: string, input: unknown) =>
    definition(name).bind(context).run(input, { signal: new AbortController().signal });
  const runApproved = (name: string, input: Record<string, unknown>) =>
    definition(name).runApproved(
      input,
      { ...context, approvalId: 'approval-1' },
      new AbortController().signal,
    );
  return { queryBus, commandBus, context, call, runApproved };
}

describe('BotProjectToolsFactory', () => {
  describe('create_project', () => {
    it('creates "local SEO" in the owner’s workspace and answers its id', async () => {
      const { commandBus, call } = setup({ command: () => project(SEO_ID, 'local SEO') });

      const result = await call('create_project', {
        name: 'local SEO',
        repositories: [
          {
            installation_id: INSTALLATION_ID,
            github_repo_id: 42,
            base_branch: 'main',
            is_default: true,
          },
        ],
      });

      expect(result.isError).toBe(false);
      const command = commandBus.execute.mock.calls[0][0] as CreateProjectCommand;
      expect(command).toBeInstanceOf(CreateProjectCommand);
      expect(command.scope).toBe(owner);
      expect(command.input).toEqual({
        name: 'local SEO',
        repositories: [
          {
            installationId: INSTALLATION_ID,
            githubRepoId: 42,
            baseBranch: 'main',
            isDefault: true,
          },
        ],
      });
      expect(result.content).toContain(`Created project ${SEO_ID} "local SEO".`);
    });

    it('refuses a name a project already has, ignoring case and spaces, and creates nothing', async () => {
      const { commandBus, call } = setup();

      const result = await call('create_project', { name: '  website ' });

      expect(result.isError).toBe(true);
      expect(result.content).toContain(`A project named "website" already exists: ${WEBSITE_ID}`);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('counts an archived project as a namesake, and says it is archived', async () => {
      const { commandBus, call } = setup();

      const result = await call('create_project', { name: 'Old site' });

      expect(result.content).toContain(`${ARCHIVED_ID} "Old site" (archived)`);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('makes a second project with the name only when the bot passes allow_same_name', async () => {
      const { commandBus, call } = setup({ command: () => project(SEO_ID, 'Website') });

      const result = await call('create_project', { name: 'Website', allow_same_name: true });

      expect(result.isError).toBe(false);
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('refuses a repository set the console would refuse (no default), creating nothing', async () => {
      const { commandBus, call } = setup();

      const result = await call('create_project', {
        name: 'local SEO',
        repositories: [
          {
            installation_id: INSTALLATION_ID,
            github_repo_id: 42,
            base_branch: 'main',
            is_default: false,
          },
        ],
      });

      expect(result.isError).toBe(true);
      expect(result.content).toContain('one repository must be is_default');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('passes on the projects module’s refusal in words, such as a second Unassigned', async () => {
      const { call } = setup({
        query: () => [],
        command: () => {
          throw new AppError(ProjectErrors.NAME_RESERVED, { detail: 'reserved' });
        },
      });

      const result = await call('create_project', { name: 'Sin asignar' });

      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/^PROJECTS_009: /);
    });
  });

  describe('update_project', () => {
    it('renames a project and clears a default, leaving the fields it was not given alone', async () => {
      const { commandBus, call } = setup({ command: () => project(WEBSITE_ID, 'Marketing site') });

      const result = await call('update_project', {
        project_id: WEBSITE_ID,
        name: 'Marketing site',
        default_agent: null,
      });

      const command = commandBus.execute.mock.calls[0][0] as UpdateProjectCommand;
      expect(command).toBeInstanceOf(UpdateProjectCommand);
      expect(command.scope).toBe(owner);
      expect(command.projectId).toBe(WEBSITE_ID);
      expect(command.changes).toEqual({ name: 'Marketing site', defaultAgent: null });
      expect(result.content).toContain(`Updated project ${WEBSITE_ID} "Marketing site".`);
    });

    it('refuses a rename onto another project’s name, but not a change of the project’s own case', async () => {
      const { commandBus, call } = setup({ command: () => project(WEBSITE_ID, 'WEBSITE') });

      const clash = await call('update_project', { project_id: SEO_ID, name: 'website' });
      expect(clash.isError).toBe(true);
      expect(commandBus.execute).not.toHaveBeenCalled();

      const own = await call('update_project', { project_id: WEBSITE_ID, name: 'WEBSITE' });
      expect(own.isError).toBe(false);
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('answers a call that changes nothing as bad input, dispatching nothing', async () => {
      const { queryBus, commandBus, call } = setup();

      const result = await call('update_project', { project_id: WEBSITE_ID });

      expect(result.content).toMatch(/^Invalid input: .*nothing to change/);
      expect(queryBus.execute).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('says a project of another workspace is not found, as the projects module answers', async () => {
      const { call } = setup({
        command: () => {
          throw new AppError(ProjectErrors.NOT_FOUND, { detail: 'No project' });
        },
      });

      const result = await call('update_project', {
        project_id: OTHER_WORKSPACE_PROJECT_ID,
        default_host_id: null,
      });

      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/^PROJECTS_001: /);
    });
  });

  describe('archive_project', () => {
    const answers = (open: WorkSessionEntity[]) => ({
      query: (query: unknown) => {
        if (query instanceof FindProjectQuery) return WORKSPACE[0];
        if (query instanceof FindSessionsQuery) return { data: open };
        return WORKSPACE;
      },
      command: () => project(WEBSITE_ID, 'Website', { archivedAt: new Date() }),
    });

    it.each(['auto', 'full'] as const)(
      'asks the person first under %s, archiving nothing until they say yes',
      async (permission) => {
        const { commandBus, context, call } = setup(
          answers([session({ state: 'resolved' })]),
          permission,
        );

        const result = await call('archive_project', { project_id: WEBSITE_ID });

        expect(result.isError).toBeFalsy();
        expect(context.approvals.request).toHaveBeenCalledWith(
          expect.objectContaining({
            tool: 'archive_project',
            perCallOnly: true,
            summary: expect.stringContaining('cannot be restored'),
          }),
        );
        expect(commandBus.execute).not.toHaveBeenCalled();
      },
    );

    it('archives once the person approved, through the projects’ own command', async () => {
      const { commandBus, runApproved } = setup(answers([]));

      const result = await runApproved('archive_project', { project_id: WEBSITE_ID });

      expect(result.isError).toBe(false);
      const command = commandBus.execute.mock.calls[0][0] as ArchiveProjectCommand;
      expect(command).toBeInstanceOf(ArchiveProjectCommand);
      expect(command.scope).toBe(owner);
      expect(command.projectId).toBe(WEBSITE_ID);
    });

    it('names the sessions still open in the project and raises no card', async () => {
      const { commandBus, context, call } = setup(answers([session()]));

      const result = await call('archive_project', { project_id: WEBSITE_ID });

      expect(result.isError).toBe(true);
      expect(result.content).toContain(`${SESSION_ID} "Fix the sitemap" (open)`);
      expect(result.content).toContain('move_session');
      expect(context.approvals.request).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('refuses the Unassigned project before asking anyone', async () => {
      const { context, call } = setup({ query: () => WORKSPACE[1] });

      const result = await call('archive_project', { project_id: UNASSIGNED_ID });

      expect(result.isError).toBe(true);
      expect(result.content).toContain('cannot be archived');
      expect(context.approvals.request).not.toHaveBeenCalled();
    });
  });

  describe('move_session', () => {
    it('lists the session under the project, changing nothing else', async () => {
      const { queryBus, commandBus, call } = setup({
        query: (query) => (query instanceof FindSessionQuery ? session() : WORKSPACE),
        command: () => ({ sessionId: SESSION_ID, hints: [] }),
      });

      const result = await call('move_session', { session_id: SESSION_ID, project_id: null });

      expect(queryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID, scope: owner }),
      );
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const command = commandBus.execute.mock.calls[0][0] as MoveSessionCommand;
      expect(command).toBeInstanceOf(MoveSessionCommand);
      expect(command.scope).toBe(owner);
      expect(command.sessionId).toBe(SESSION_ID);
      expect(command.projectId).toBe(UNASSIGNED_ID);
      expect(result.content).toContain(
        `Moved session ${SESSION_ID} "Fix the sitemap" from "Website" to "Unassigned"`,
      );
      expect(result.content).toContain('keeps its id, history, state (open) and worktree');
    });

    it('refuses a project the owner’s workspace does not hold, moving nothing', async () => {
      const { commandBus, call } = setup({
        query: (query) => (query instanceof FindSessionQuery ? session() : WORKSPACE),
      });

      const result = await call('move_session', {
        session_id: SESSION_ID,
        project_id: OTHER_WORKSPACE_PROJECT_ID,
      });

      expect(result.isError).toBe(true);
      expect(result.content).toContain(
        `No project ${OTHER_WORKSPACE_PROJECT_ID} in this workspace`,
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('refuses a session the owner cannot read, as the sessions module answers, moving nothing', async () => {
      const { commandBus, call } = setup({
        query: (query) => {
          if (query instanceof FindSessionQuery) {
            throw new AppError(SessionErrors.NOT_FOUND, { detail: 'No session' });
          }
          return WORKSPACE;
        },
      });

      const result = await call('move_session', { session_id: SESSION_ID, project_id: SEO_ID });

      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/^SESSIONS_001: /);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('refuses an archived project, moving nothing', async () => {
      const { commandBus, call } = setup({
        query: (query) => (query instanceof FindSessionQuery ? session() : WORKSPACE),
      });

      const result = await call('move_session', {
        session_id: SESSION_ID,
        project_id: ARCHIVED_ID,
      });

      expect(result.isError).toBe(true);
      expect(result.content).toContain('"Old site" is archived');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('says a session already in the project is there, writing nothing', async () => {
      const { commandBus, call } = setup({
        query: (query) => (query instanceof FindSessionQuery ? session() : WORKSPACE),
      });

      const result = await call('move_session', { session_id: SESSION_ID, project_id: WEBSITE_ID });

      expect(result.isError).toBe(false);
      expect(result.content).toContain('already in "Website"');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('passes on the sessions module’s refusal of a closed session in words', async () => {
      const { call } = setup({
        query: (query) => (query instanceof FindSessionQuery ? session() : WORKSPACE),
        command: () => {
          throw new AppError(SessionErrors.ALREADY_RESOLVED, { detail: 'closed' });
        },
      });

      const result = await call('move_session', { session_id: SESSION_ID, project_id: null });

      expect(result.isError).toBe(true);
      expect(result.content).toMatch(/^SESSIONS_005: /);
    });

    it('runs without asking under Approve for me: a move stays inside Oppenheimer and can be put back', async () => {
      const { context, call } = setup({
        query: (query) => (query instanceof FindSessionQuery ? session() : WORKSPACE),
        command: () => ({ sessionId: SESSION_ID, hints: [] }),
      });

      await call('move_session', { session_id: SESSION_ID, project_id: null });

      expect(context.approvals.request).not.toHaveBeenCalled();
    });
  });
});
