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
import { promptText } from '../domain/bot-prompt-text.policy';
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
  installation_id: z.uuid().describe(promptText('plan/tools-projects.repository-installation-id')),
  github_repo_id: z
    .number()
    .int()
    .positive()
    .describe(promptText('plan/tools-projects.repository-github-repo-id')),
  base_branch: z
    .string()
    .trim()
    .min(FIELD_BOUNDS.gitRef.min)
    .max(FIELD_BOUNDS.gitRef.max)
    .describe(promptText('plan/tools-projects.repository-base-branch')),
  is_default: z.boolean().describe(promptText('plan/tools-projects.repository-is-default')),
});

const repositoriesInput = z
  .array(repositoryInput)
  .max(MAX_PROJECT_REPOSITORIES)
  .describe(
    promptText('plan/tools-projects.repositories', {
      maxProjectRepositories: String(MAX_PROJECT_REPOSITORIES),
    }),
  );

const nameInput = z
  .string()
  .trim()
  .min(FIELD_BOUNDS.displayName.min)
  .max(FIELD_BOUNDS.displayName.max);

const allowSameNameInput = z
  .boolean()
  .default(false)
  .describe(promptText('plan/tools-projects.allow-same-name'));

/**
 * Projects, the writes: make one, change its name, repositories and defaults,
 * archive or restore it, and list an existing session under another. Each
 * dispatches the projects' or sessions' own command in the owner's scope,
 * through the same request schemas the console's routes validate with, so a bot
 * meets the rules a person does: the Unassigned project keeps its name,
 * repositories come from a connected installation, an archived project takes
 * nothing new, a project another workspace owns is not found. Making, changing,
 * restoring and moving stay inside Oppenheimer and can be put back, so they run
 * under Approve for me; archiving stops work from being started and pauses
 * automations that a restore leaves paused, so it asks every time, under every
 * preset.
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
      description: promptText('plan/tools-projects.create-project'),
      input: z.object({
        name: nameInput.describe(promptText('plan/tools-projects.create-project-name')),
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
      description: promptText('plan/tools-projects.update-project'),
      input: z
        .object({
          project_id: z
            .uuid()
            .describe(promptText('plan/tools-projects.update-project-project-id')),
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
          { message: promptText('plan/tools-projects.update-project-message') },
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
      description: promptText('plan/tools-projects.archive-project'),
      input: z.object({
        project_id: z.uuid().describe(promptText('plan/tools-projects.update-project-project-id')),
      }),
      normalize: async (input, context) => {
        const project = await this.project(context, input.project_id);
        if (project.isUnassigned) {
          throw new BotToolRefusal(promptText('plan/tools-projects.archive-unassigned'));
        }
        if (project.isArchived) {
          throw new BotToolRefusal(
            promptText('plan/tools-projects.archive-already-archived', {
              name: project.name,
            }),
          );
        }
        const open = await this.openSessions(context, project.id);
        if (open.length > 0) {
          const listed = open.map(
            (session) => `${session.id} "${session.name}" (${session.state})`,
          );
          throw new BotToolRefusal(
            promptText('plan/tools-projects.archive-open-sessions', {
              name: project.name,
              listed: listed.join(', '),
            }),
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
        return promptText('plan/tools-projects.archive-project-archived-project-tasks', {
          id: project.id,
          name: project.name,
        });
      },
    });
  }

  private restoreProject(): BotToolDefinition {
    return defineBotTool({
      name: 'restore_project',
      scope: 'projects:write',
      description: promptText('plan/tools-projects.restore-project'),
      input: z.object({
        project_id: z.uuid().describe(promptText('plan/tools-projects.restore-project-project-id')),
      }),
      run: async (input, context) => {
        const { project, restored } = await this.commandBus.execute<
          RestoreProjectCommand,
          RestoreProjectResult
        >(new RestoreProjectCommand({ scope: context.owner, projectId: input.project_id }));
        if (!restored) {
          return promptText('plan/tools-projects.restore-not-archived', {
            id: project.id,
            name: project.name,
          });
        }
        return promptText('plan/tools-projects.restore-project-restored-project-work', {
          id: project.id,
          name: project.name,
          describeProjectInFull: describeProjectInFull(project, context),
        });
      },
    });
  }

  private moveSession(): BotToolDefinition {
    return defineBotTool({
      name: 'move_session',
      scope: 'sessions:write',
      description: promptText('plan/tools-projects.move-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('plan/tools-projects.move-session-session-id')),
        project_id: z
          .uuid()
          .nullable()
          .describe(promptText('plan/tools-projects.move-session-project-id')),
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
              ? promptText('plan/tools-projects.move-session-workspace-has-unassigned')
              : promptText('plan/tools-projects.move-session-project-workspace-list', {
                  projectId: input.project_id,
                }),
          );
        }
        if (target.isArchived) {
          throw new BotToolRefusal(
            promptText('plan/tools-projects.move-session-project-archived-so', {
              name: target.name,
            }),
          );
        }
        const from = projects.find((project) => project.id === session.projectId);
        const fromLabel = from ? `"${from.name}"` : `project ${session.projectId}`;
        if (session.projectId === target.id) {
          return promptText('plan/tools-projects.move-session-session-already-nothing', {
            id: session.id,
            name: session.name,
            name2: target.name,
          });
        }
        await this.commandBus.execute<MoveSessionCommand, SessionCommandResult>(
          new MoveSessionCommand({
            scope: context.owner,
            sessionId: session.id,
            projectId: target.id,
          }),
        );
        return promptText('plan/tools-projects.move-session-moved-session-from', {
          id: session.id,
          name: session.name,
          fromLabel,
          name2: target.name,
          id2: target.id,
          state: session.state,
        });
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
