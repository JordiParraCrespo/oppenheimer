import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FIELD_BOUNDS, MAX_PROJECT_REPOSITORIES, SESSION_STATES } from '@oppenheimer/shared';
import { CODING_AGENT_IDS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { ArchiveProjectCommand } from '../../projects/commands/archive-project/archive-project.command';
import { CreateProjectCommand } from '../../projects/commands/create-project/create-project.command';
import {
  RestoreProjectCommand,
  type RestoreProjectResult,
} from '../../projects/commands/restore-project/restore-project.command';
import { UpdateProjectCommand } from '../../projects/commands/update-project/update-project.command';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import { FindProjectsQuery } from '../../projects/queries/find-projects/find-projects.query';
import { MoveSessionCommand } from '../../sessions/commands/move-session/move-session.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import { FindSessionsQuery } from '../../sessions/queries/find-sessions/find-sessions.query';
import { describeProjectInFull } from '../bot-plan-tool.mapper';
import { createProjectBody, type ProjectBody, updateProjectBody } from '../bot-project-tool.mapper';
import { namesakeRefusal, namesakesOf } from '../domain/bot-project.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** How many open sessions of each state `archive_project` names when it refuses. */
const OPEN_SESSIONS_SHOWN = 20;

const repositoryInput = z.object({
  installation_id: z.uuid().describe('The installation id list_repositories or get_project shows.'),
  github_repo_id: z.number().int().positive().describe("GitHub's repository id, from the same."),
  base_branch: z
    .string()
    .trim()
    .min(FIELD_BOUNDS.gitRef.min)
    .max(FIELD_BOUNDS.gitRef.max)
    .describe('The branch its sessions start from, usually main.'),
  is_default: z.boolean().describe('Offered first for a new session; exactly one should be.'),
});

const repositoriesInput = z
  .array(repositoryInput)
  .max(MAX_PROJECT_REPOSITORIES)
  .describe(
    `The project's repositories as a whole set, at most ${MAX_PROJECT_REPOSITORIES}: one marked is_default when there are any, none twice.`,
  );

const nameInput = z
  .string()
  .trim()
  .min(FIELD_BOUNDS.displayName.min)
  .max(FIELD_BOUNDS.displayName.max);

const allowSameNameInput = z
  .boolean()
  .default(false)
  .describe(
    'Only when the person said they want a second project with a name another already has.',
  );

/**
 * Projects, the writes (`25-bots.md` §4.3): make one, change its name,
 * repositories and defaults, archive or restore it, and list an existing
 * session under another. Each dispatches the projects' or sessions' own command in the
 * owner's scope, through the same request schemas the console's routes
 * validate with, so a bot meets the rules a person does: the Unassigned
 * project keeps its name, repositories come from a connected installation, an
 * archived project takes nothing new, a project another workspace owns is not
 * found. Making, changing, restoring and moving stay inside Oppenheimer and
 * can be put back, so they run under Approve for me; archiving stops work
 * from being started and pauses automations that a restore leaves paused, so
 * it asks every time, under every preset.
 */
@Injectable()
export class BotProjectToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools: beside the plan's. */
  readonly group = 'plan' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.createProject(),
      this.updateProject(),
      this.archiveProject(),
      this.restoreProject(),
      this.moveSession(),
    ];
  }

  private createProject(): BotToolDefinition {
    return defineBotTool({
      name: 'create_project',
      scope: 'projects:write',
      description: `Makes a project: a name, optionally the repositories its sessions usually work on (ids from list_repositories) and the host and agent a new session is offered. Answers the new project's id. It refuses a name a project already has, archived ones included, so ask the person which they mean before passing allow_same_name. When the person names a project loosely, call list_projects first; never guess between two.`,
      input: z.object({
        name: nameInput.describe('What the person calls it, as they wrote it.'),
        repositories: repositoriesInput.default([]),
        default_host_id: z.uuid().optional().describe('A host from list_hosts.'),
        default_agent: z.enum(CODING_AGENT_IDS).optional(),
        allow_same_name: allowSameNameInput,
      }),
      run: async (input, context) => {
        await this.refuseNamesake(context, input.name, input.allow_same_name);
        const dto = bodyOrRefuse(createProjectBody(input));
        const project = await this.commandBus.execute<CreateProjectCommand, ProjectEntity>(
          new CreateProjectCommand({ scope: context.owner, input: dto }),
        );
        return `Created project ${project.id} "${project.name}".\n${describeProjectInFull(project, context)}`;
      },
    });
  }

  private updateProject(): BotToolDefinition {
    return defineBotTool({
      name: 'update_project',
      scope: 'projects:write',
      description:
        "Changes a project's name, repositories or default host and agent; only the fields you pass change, and null clears a default. repositories replaces the whole set: read get_project first and pass back the ones to keep with their ids. The slug never changes, the Unassigned project keeps its name, an archived project cannot be changed, and sessions already running are not touched. A rename onto another project's name is refused unless allow_same_name.",
      input: z
        .object({
          project_id: z.uuid().describe('A project id from list_projects.'),
          name: nameInput.optional(),
          repositories: repositoriesInput.optional(),
          default_host_id: z.uuid().nullable().optional().describe('A host, or null to clear.'),
          default_agent: z.enum(CODING_AGENT_IDS).nullable().optional(),
          allow_same_name: allowSameNameInput,
        })
        .refine(
          (value) =>
            value.name !== undefined ||
            value.repositories !== undefined ||
            value.default_host_id !== undefined ||
            value.default_agent !== undefined,
          { message: 'nothing to change: pass at least one field' },
        ),
      run: async (input, context) => {
        if (input.name !== undefined) {
          await this.refuseNamesake(context, input.name, input.allow_same_name, input.project_id);
        }
        const dto = bodyOrRefuse(updateProjectBody(input));
        const project = await this.commandBus.execute<UpdateProjectCommand, ProjectEntity>(
          new UpdateProjectCommand({
            scope: context.owner,
            projectId: input.project_id,
            changes: dto,
          }),
        );
        return `Updated project ${project.id} "${project.name}".\n${describeProjectInFull(project, context)}`;
      },
    });
  }

  private archiveProject(): BotToolDefinition {
    return defineBotTool({
      name: 'archive_project',
      scope: 'projects:write',
      asks: 'always',
      perCallOnly: true,
      description:
        'Archives a project: nothing new can be started or listed in it, its automations are paused, and its tasks and closed sessions stay where they are. restore_project brings it back with its name and slug, but its automations stay paused until the person resumes them. It is refused while the project has sessions that are not closed; move them (move_session) or close them first. Projects are never deleted: archiving is what the console calls deleting. Always asks the person first.',
      input: z.object({ project_id: z.uuid().describe('A project id from list_projects.') }),
      normalize: async (input, context) => {
        const project = await this.project(context, input.project_id);
        if (project.isUnassigned) {
          throw new BotToolRefusal(
            'The Unassigned project is where work with no project goes; it cannot be archived.',
          );
        }
        if (project.isArchived) {
          throw new BotToolRefusal(`Project "${project.name}" is already archived.`);
        }
        const open = await this.openSessions(context, project.id);
        if (open.length > 0) {
          const listed = open.map(
            (session) => `${session.id} "${session.name}" (${session.state})`,
          );
          throw new BotToolRefusal(
            `Project "${project.name}" still has sessions that are not closed: ${listed.join(', ')}. Nothing was archived. Ask the person whether to move them to another project (move_session) or close them first.`,
          );
        }
        return input;
      },
      summarize: async (input, context) => {
        const project = await this.project(context, input.project_id);
        return `Archive the project "${project.name}" (${project.slug}). Nothing new can go in it and its automations are paused; a restore brings it back, but not its automations`;
      },
      run: async (input, context) => {
        const project = await this.commandBus.execute<ArchiveProjectCommand, ProjectEntity>(
          new ArchiveProjectCommand({ scope: context.owner, projectId: input.project_id }),
        );
        return `Archived project ${project.id} "${project.name}". Its tasks and past sessions stay listed under it; list_projects shows it only with include_archived.`;
      },
    });
  }

  private restoreProject(): BotToolDefinition {
    return defineBotTool({
      name: 'restore_project',
      scope: 'projects:write',
      description:
        'Restores an archived project (list_projects with include_archived shows them): work can be started and listed in it again, with its name, slug, repositories, tasks and past sessions as they were. The automations its archive paused stay paused; say so, and point the person at them (list_automations with its project_id). Restoring an active project changes nothing. When the person names an archived project loosely and more than one fits, ask which.',
      input: z.object({
        project_id: z
          .uuid()
          .describe('An archived project id from list_projects with include_archived.'),
      }),
      run: async (input, context) => {
        const { project, restored } = await this.commandBus.execute<
          RestoreProjectCommand,
          RestoreProjectResult
        >(new RestoreProjectCommand({ scope: context.owner, projectId: input.project_id }));
        if (!restored) {
          return `Project ${project.id} "${project.name}" is not archived. Nothing changed.`;
        }
        return `Restored project ${project.id} "${project.name}"; work can be started in it again. The automations its archive paused are still paused.\n${describeProjectInFull(project, context)}`;
      },
    });
  }

  private moveSession(): BotToolDefinition {
    return defineBotTool({
      name: 'move_session',
      scope: 'sessions:write',
      description:
        "Moves a session to another project, or to Unassigned when project_id is null. Only the project it is filed under changes: the session keeps its id, history, state, worktree and branch, and a running agent is not interrupted. The move is recorded in the session's log. A closed session cannot be moved, nor one moved into an archived project. When the person names the session or the project loosely, find it with list_sessions or list_projects, and ask if more than one fits.",
      input: z.object({
        session_id: z.uuid().describe('The session to move (from list_sessions).'),
        project_id: z
          .uuid()
          .nullable()
          .describe('The project to list it under (from list_projects); null for Unassigned.'),
      }),
      run: async (input, context) => {
        const [session, projects] = await Promise.all([
          this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
            new FindSessionQuery({ scope: context.owner, sessionId: input.session_id }),
          ),
          this.projects(context),
        ]);
        const target =
          input.project_id === null
            ? projects.find((project) => project.isUnassigned)
            : projects.find((project) => project.id === input.project_id);
        if (!target) {
          throw new BotToolRefusal(
            input.project_id === null
              ? 'This workspace has no Unassigned project to move the session to.'
              : `No project ${input.project_id} in this workspace. list_projects names the ones there are.`,
          );
        }
        if (target.isArchived) {
          throw new BotToolRefusal(
            `Project "${target.name}" is archived, so nothing new can be listed in it. Nothing was moved; ask the person for another project.`,
          );
        }
        const from = projects.find((project) => project.id === session.projectId);
        const fromLabel = from ? `"${from.name}"` : `project ${session.projectId}`;
        if (session.projectId === target.id) {
          return `Session ${session.id} "${session.name}" is already in "${target.name}". Nothing changed.`;
        }
        await this.commandBus.execute<MoveSessionCommand, SessionCommandResult>(
          new MoveSessionCommand({
            scope: context.owner,
            sessionId: session.id,
            projectId: target.id,
          }),
        );
        return `Moved session ${session.id} "${session.name}" from ${fromLabel} to "${target.name}" (${target.id}). It keeps its id, history, state (${session.state}) and worktree; nothing on the host changed.`;
      },
    });
  }

  /** Refuses a name another project has, unless the person asked for a second one. */
  private async refuseNamesake(
    context: BotToolCallContext,
    name: string,
    allowed: boolean,
    exceptId?: string,
  ): Promise<void> {
    if (allowed) return;
    const refusal = namesakeRefusal(
      name,
      namesakesOf(await this.projects(context), name, exceptId),
    );
    if (refusal) throw new BotToolRefusal(`${refusal} Nothing was changed.`);
  }

  /** Every project the owner can read, archived ones too. */
  private projects(context: BotToolCallContext): Promise<ProjectEntity[]> {
    return this.queryBus.execute<FindProjectsQuery, ProjectEntity[]>(
      new FindProjectsQuery({ scope: context.owner, includeArchived: true }),
    );
  }

  private project(context: BotToolCallContext, projectId: string): Promise<ProjectEntity> {
    return this.queryBus.execute<FindProjectQuery, ProjectEntity>(
      new FindProjectQuery({ scope: context.owner, projectId }),
    );
  }

  /**
   * The project's sessions that are not closed, as the archive counts them
   * (every state but `resolved`), each state asked of the sessions' own
   * filter so an older open session is not missed behind newer closed ones.
   * At most `OPEN_SESSIONS_SHOWN` per state are named. The archive itself is
   * still the authority, under the project row's lock.
   */
  private async openSessions(
    context: BotToolCallContext,
    projectId: string,
  ): Promise<WorkSessionEntity[]> {
    const pages = await Promise.all(
      SESSION_STATES.filter((state) => state !== 'resolved').map((state) =>
        this.queryBus.execute<FindSessionsQuery, { data: WorkSessionEntity[] }>(
          new FindSessionsQuery({
            scope: context.owner,
            page: 1,
            limit: OPEN_SESSIONS_SHOWN,
            projectId,
            state,
          }),
        ),
      ),
    );
    return pages.flatMap((page) => page.data);
  }
}

/** The checked body, or the tool's refusal in its words. */
function bodyOrRefuse<Dto>(outcome: ProjectBody<Dto>): Dto {
  if ('refusal' in outcome) throw new BotToolRefusal(outcome.refusal);
  return outcome.body;
}
