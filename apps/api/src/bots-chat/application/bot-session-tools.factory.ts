import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CODING_AGENT_IDS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { StopSessionCommand } from '../../sessions/commands/stop-session/stop-session.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import {
  idempotencyKeyOf,
  planSession,
  sessionHostId,
  sessionSummary,
} from '../bot-session-tool.mapper';
import {
  type BotToolArea,
  type BotToolContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Sessions, the writes (`25-bots.md` §4.2): start a coding agent on a host
 * with a task, or stop one. Both reach outside Oppenheimer (they run things
 * on the owner's machine), so under Approve for me they ask first, and each
 * says on the card what it will do, by name. A bot's session is the owner's,
 * started in their scope, marked `bot`.
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
      scope: 'sessions:write',
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
      summarize: async (input, context) => {
        const project = input.project_id ? await this.project(context, input.project_id) : null;
        const hostId = sessionHostId(input, project, context.homeHostId);
        const host = hostId ? await this.hostName(context, hostId) : null;
        return sessionSummary(input, project, host);
      },
      run: async (input, context) => {
        const project = input.project_id ? await this.project(context, input.project_id) : null;
        const plan = planSession(input, project, context.homeHostId);
        if ('refusal' in plan) return plan.refusal;
        const { body, hostId } = plan;
        const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
          new CreateSessionCommand({
            scope: context.owner,
            userId: context.owner.userId,
            input: body,
            idempotencyKey: idempotencyKeyOf(context.turnId, body),
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
      scope: 'sessions:write',
      asks: true,
      description:
        "Stops a running session's agent. The worktree and its changes are kept. Use it when the person asks to stop one, or for a session you started that went wrong.",
      input: z.object({
        session_id: z.uuid().describe('The session to stop (from list_sessions).'),
      }),
      summarize: async (input, context) => {
        const session = await this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
          new FindSessionQuery({ scope: context.owner, sessionId: input.session_id }),
        );
        return `Stop the session "${session.name}" (${session.id})`;
      },
      run: async (input, context) => {
        await this.commandBus.execute<StopSessionCommand, SessionCommandResult>(
          new StopSessionCommand({ scope: context.owner, sessionId: input.session_id }),
        );
        return `Asked session ${input.session_id} to stop. It stops once its host hears it; get_session shows when it has.`;
      },
    });
  }

  /** The host's name as the owner sees it; its id when they cannot read it. */
  private async hostName(context: BotToolContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview?.host.name ?? `host ${hostId}`;
  }

  private project(context: BotToolContext, projectId: string): Promise<ProjectEntity> {
    return this.queryBus.execute<FindProjectQuery, ProjectEntity>(
      new FindProjectQuery({ scope: context.owner, projectId }),
    );
  }
}
