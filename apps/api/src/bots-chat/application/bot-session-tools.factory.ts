import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { type CreateSessionDto, createSessionSchema } from '@oppenheimer/shared';
import { CODING_AGENT_IDS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { StopSessionCommand } from '../../sessions/commands/stop-session/stop-session.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import {
  type BotToolArea,
  type BotToolContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Sessions, the writes (`25-bots.md` §4.2): start a coding agent on a host
 * with a task, or stop one. Both reach outside Oppenheimer (they run things
 * on the owner's machine), so under Approve for me they ask first. A bot's
 * session is the owner's, started in their scope, marked `bot`.
 */
@Injectable()
export class BotSessionToolsFactory implements BotToolArea {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.startSession(), this.stopSession()];
  }

  private startSession(): BotToolDefinition {
    return defineBotTool({
      name: 'start_session',
      asks: true,
      description:
        "Starts a coding agent (Claude Code by default) on a host with a task: in a new worktree of one of a project's repositories, or in a folder already on the host. Use it for work on code; it returns at once with the session's id, and the agent works on its own. Check its progress later with get_session. The host defaults to the project's default host, then your home host.",
      input: z.object({
        task: z
          .string()
          .min(1)
          .max(20_000)
          .describe('What the agent should do, in full: it starts with only this.'),
        project_id: z
          .uuid()
          .optional()
          .describe('The project whose repository to work in (from list_projects).'),
        repository: z
          .string()
          .max(200)
          .optional()
          .describe(
            "owner/name of one of the project's repositories; its default one when omitted.",
          ),
        folder: z
          .string()
          .max(1_024)
          .optional()
          .describe('Instead of a repository: an absolute path to a folder already on the host.'),
        host_id: z.uuid().optional().describe('The host to run on (from list_hosts).'),
        agent: z
          .enum(CODING_AGENT_IDS)
          .optional()
          .describe('Which coding agent; claude-code when omitted.'),
        name: z.string().min(1).max(80).optional().describe('A short name for the session.'),
      }),
      run: async (input, context) => {
        const project = input.project_id ? await this.project(context, input.project_id) : null;
        if (!input.folder && !project) {
          return 'Give a project_id (to work in one of its repositories) or a folder on the host.';
        }
        const hostId = input.host_id ?? project?.defaultHostId ?? context.homeHostId;
        if (!hostId) {
          return 'No host given, and neither the project nor you have a default one. Ask which host to use (list_hosts).';
        }
        const checkout = input.folder
          ? null
          : pickRepository(project as ProjectEntity, input.repository);
        if (checkout && 'reason' in checkout) return checkout.reason;
        const parsed = createSessionSchema.safeParse({
          hostId,
          agent: input.agent ?? project?.defaultAgent ?? 'claude-code',
          projectId: project?.id,
          name: input.name,
          prompt: input.task,
          ...(input.folder
            ? { folder: input.folder }
            : { checkouts: [checkout], cwdGithubRepoId: checkout?.githubRepoId }),
        });
        if (!parsed.success) {
          const fields = parsed.error.issues.map((issue) => issue.path.join('.') || 'input');
          return `Not started: the session would be invalid (${[...new Set(fields)].join(', ')}). Check the task, folder and name.`;
        }
        const body: CreateSessionDto = parsed.data;
        const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
          new CreateSessionCommand({
            scope: context.owner,
            userId: context.owner.userId,
            input: body,
            idempotencyKey: idempotencyKeyOf(context, body),
            origin: 'bot',
          }),
        );
        const offline = result.hints.includes('host_offline')
          ? ' The host is offline: the session is queued and starts when it comes back.'
          : '';
        return `Started session ${result.sessionId} on host ${hostId}.${offline} The agent works on its own; read it later with get_session.`;
      },
    });
  }

  private stopSession(): BotToolDefinition {
    return defineBotTool({
      name: 'stop_session',
      asks: true,
      description:
        "Stops a running session's agent. The worktree and its changes are kept. Use it when the person asks to stop one, or for a session you started that went wrong.",
      input: z.object({
        session_id: z.uuid().describe('The session to stop (from list_sessions).'),
      }),
      run: async (input, context) => {
        await this.commandBus.execute<StopSessionCommand, SessionCommandResult>(
          new StopSessionCommand({ scope: context.owner, sessionId: input.session_id }),
        );
        return `Asked session ${input.session_id} to stop. It stops once its host hears it; get_session shows when it has.`;
      },
    });
  }

  private project(context: BotToolContext, projectId: string): Promise<ProjectEntity> {
    return this.queryBus.execute<FindProjectQuery, ProjectEntity>(
      new FindProjectQuery({ scope: context.owner, projectId }),
    );
  }
}

/** The project's repository to check out: the one named, or its default. */
function pickRepository(
  project: ProjectEntity,
  name: string | undefined,
): { installationId: string; githubRepoId: number; baseBranch: string } | { reason: string } {
  const repositories = project.repositories;
  const chosen = name
    ? repositories.find((repo) => repo.repositoryFullName.toLowerCase() === name.toLowerCase())
    : (repositories.find((repo) => repo.isDefault) ?? repositories[0]);
  if (!chosen) {
    const names = repositories.map((repo) => repo.repositoryFullName).join(', ') || 'none';
    return {
      reason: name
        ? `The project has no repository ${name}. Its repositories: ${names}.`
        : 'The project has no repository. Use a folder, or ask the person to add one to the project.',
    };
  }
  return {
    installationId: chosen.installationId,
    githubRepoId: Number(chosen.githubRepoId),
    baseBranch: chosen.baseBranch,
  };
}

/** The same call in the same turn starts one session, however often the model repeats it. */
function idempotencyKeyOf(context: BotToolContext, body: CreateSessionDto): string {
  const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
  return `bot:${context.turnId}:${digest}`;
}
