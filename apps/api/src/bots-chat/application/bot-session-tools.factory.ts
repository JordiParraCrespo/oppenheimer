import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FIELD_BOUNDS, fitsPromptBound } from '@oppenheimer/shared';
import { CODING_AGENT_IDS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import { AnswerSessionDecisionCommand } from '../../sessions/commands/answer-session-decision/answer-session-decision.command';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { SendSessionPromptCommand } from '../../sessions/commands/send-session-prompt/send-session-prompt.command';
import { StopSessionCommand } from '../../sessions/commands/stop-session/stop-session.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import {
  FindLatestSessionEventsQuery,
  type LatestSessionEvents,
} from '../../sessions/queries/find-latest-session-events/find-latest-session-events.query';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import {
  decisionAnswerOf,
  decisionAnswerSummary,
  planSession,
  promptSummary,
  sentTurnOf,
  sessionHostId,
  sessionSummary,
} from '../bot-session-tool.mapper';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { BotSessionWatchResolver } from './bot-session-watch.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Sessions, the writes (`25-bots.md` §4.2): start a coding agent on a host
 * with a task, give a running one a follow-up prompt or answer what it asks,
 * or stop one. Each reaches outside Oppenheimer (they run things on the
 * owner's machine), so under Approve for me they ask first, and each says on
 * the card what it will do, by name. A bot's session is the owner's, started
 * in their scope, marked `bot`; a prompt it sends is logged as the bot's.
 */
@Injectable()
export class BotSessionToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly watches: BotSessionWatchResolver,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.startSession(), this.sendToSession(), this.answerSession(), this.stopSession()];
  }

  private startSession(): BotToolDefinition {
    return defineBotTool({
      name: 'start_session',
      scope: 'sessions:write',
      asks: true,
      subject: async (input, context) => {
        if (!input.project_id) return null;
        const project = await this.project(context, input.project_id).catch(() => null);
        return {
          kind: 'project',
          key: input.project_id,
          label: project?.name ?? `project ${input.project_id}`,
        };
      },
      description:
        "Starts a coding agent (Claude Code by default) on a host with a task: in a new worktree of one of a project's repositories, or in a folder already on the host. Use it for work on code; it returns at once with the session's id, and the agent works on its own. You are subscribed to it unless watch is false. The host defaults to the project's default host, then your home host.",
      input: z.object({
        // The session's first prompt, held to the same rule here so a task
        // too long is the tool's own error, before any card is raised. Only
        // the message is the tool's: it is written for the model.
        task: z
          .string()
          .trim()
          .min(FIELD_BOUNDS.prompt.min)
          .max(FIELD_BOUNDS.prompt.maxBytes)
          .refine(fitsPromptBound, {
            message: `Too long: at most ${FIELD_BOUNDS.prompt.maxBytes} bytes (UTF-8). Write a shorter brief; the agent can read files and the repository for the rest.`,
          })
          .describe(
            `What the agent should do: it starts with only this. At most ${FIELD_BOUNDS.prompt.maxBytes} bytes, so keep it to a focused brief and point at files rather than pasting them.`,
          ),
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
        watch: z
          .boolean()
          .optional()
          .describe('Be woken when its task needs input or ends (default true).'),
      }),
      summarize: async (input, context) => {
        // A project the owner cannot read still gets a card, naming it by id: the call says why.
        const project = input.project_id
          ? await this.project(context, input.project_id).catch(() => null)
          : null;
        const hostId = sessionHostId(input, project, context.homeHostId);
        const host = hostId ? await this.hostName(context, hostId) : null;
        return sessionSummary(input, project, host);
      },
      run: async (input, context) => {
        const project = input.project_id ? await this.project(context, input.project_id) : null;
        const plan = planSession(input, project, context.homeHostId);
        if ('refusal' in plan) throw new BotToolRefusal(plan.refusal);
        const { body, hostId } = plan;
        const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
          new CreateSessionCommand({
            scope: context.owner,
            userId: context.owner.userId,
            input: body,
            idempotencyKey: idempotencyKeyOf(context.turnId, body, context.approvalId),
            origin: 'bot',
          }),
        );
        const offline = result.hints.includes('host_offline')
          ? ' The host is offline: the session is queued and starts when it comes back.'
          : '';
        const watched =
          input.watch === false
            ? 'You are not watching it; read it later with get_session.'
            : await this.watches.watchStarted(context, result.sessionId);
        return {
          content: `Started session ${result.sessionId} on host ${hostId}.${offline} The agent works on its own. ${watched}`,
          sessionId: result.sessionId,
        };
      },
    });
  }

  private sendToSession(): BotToolDefinition {
    return defineBotTool({
      name: 'send_to_session',
      scope: 'sessions:write',
      asks: true,
      subject: (input, context) => this.sessionSubject(context, input.session_id),
      description:
        "Types a follow-up prompt into a running session's agent, as a person would at its prompt: more instructions, a correction, the next step. Only while the agent waits at its prompt (get_session's group idle or ready-for-review); while it works, wait for it; when it asks a question or a permission, use answer_session. The session's log records the prompt as yours. You are subscribed to the task it starts unless watch is false.",
      input: z.object({
        session_id: z.uuid().describe('The session to prompt (from list_sessions).'),
        text: z
          .string()
          .trim()
          .min(FIELD_BOUNDS.prompt.min)
          .max(FIELD_BOUNDS.prompt.maxBytes)
          .refine(fitsPromptBound, {
            message: `Too long: at most ${FIELD_BOUNDS.prompt.maxBytes} bytes (UTF-8). Write a shorter prompt.`,
          })
          .describe(`What to tell the agent. At most ${FIELD_BOUNDS.prompt.maxBytes} bytes.`),
        watch: z
          .boolean()
          .optional()
          .describe('Be woken when the task it starts needs input or ends (default true).'),
      }),
      summarize: async (input, context) =>
        promptSummary(input, await this.session(context, input.session_id)),
      run: async (input, context) => {
        // Read first: the prompt opens the next task, or joins the live one.
        const turn = sentTurnOf((await this.session(context, input.session_id)).latestTurn);
        await this.commandBus.execute<SendSessionPromptCommand, SessionCommandResult>(
          new SendSessionPromptCommand({
            scope: context.owner,
            sessionId: input.session_id,
            text: input.text,
            sender: { kind: 'bot', botId: context.botId, turnId: context.turnId },
          }),
        );
        const watched =
          input.watch === false
            ? 'Read how it goes with get_session or read_session.'
            : await this.watches.watchSent(context, input.session_id, turn);
        return `Sent the prompt to session ${input.session_id}. ${watched}${await this.readAfter(context, input.session_id)}`;
      },
    });
  }

  private answerSession(): BotToolDefinition {
    return defineBotTool({
      name: 'answer_session',
      scope: 'sessions:write',
      asks: true,
      subject: (input, context) => this.sessionSubject(context, input.session_id),
      description:
        "Answers what a session's agent is waiting on: a question it asked (answers, one per question, picks by index and/or words of your own) or a permission dialog (option, by index). get_session shows the decision, its id and its options. Answer only what the person's instructions settle; otherwise tell them.",
      input: z.object({
        session_id: z.uuid().describe('The session (from list_sessions).'),
        decision_id: z.string().min(1).max(128).describe("The decision's id, from get_session."),
        answers: z
          .array(
            z.object({
              picks: z
                .array(z.number().int().min(0))
                .max(6)
                .default([])
                .describe('Option indexes; one for a single-choice question.'),
              other: z
                .string()
                .max(1_000)
                .optional()
                .describe('Words of your own, in place of or beside the picks.'),
            }),
          )
          .min(1)
          .max(4)
          .optional()
          .describe('For a question: one answer per question, in order.'),
        option: z
          .number()
          .int()
          .min(0)
          .max(8)
          .optional()
          .describe("For a permission dialog: the option's index."),
      }),
      summarize: async (input, context) => {
        const summary = decisionAnswerSummary(input, await this.session(context, input.session_id));
        if ('refusal' in summary) throw new BotToolRefusal(summary.refusal);
        return summary.line;
      },
      run: async (input, context) => {
        if ((input.answers === undefined) === (input.option === undefined)) {
          throw new BotToolRefusal(
            'Give answers (for a question) or option (for a permission dialog), not both.',
          );
        }
        await this.commandBus.execute<AnswerSessionDecisionCommand, SessionCommandResult>(
          new AnswerSessionDecisionCommand({
            scope: context.owner,
            sessionId: input.session_id,
            answer: decisionAnswerOf(input),
          }),
        );
        return `Answered session ${input.session_id}. The agent takes it from here; get_session shows what it does next.${await this.readAfter(context, input.session_id)}`;
      },
    });
  }

  private stopSession(): BotToolDefinition {
    return defineBotTool({
      name: 'stop_session',
      scope: 'sessions:write',
      asks: true,
      subject: (input, context) => this.sessionSubject(context, input.session_id),
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

  /**
   * Where the session's log stood once your input was in, as the hint the
   * answer ends with: `read_session` after it reads only what followed. None
   * when the log cannot be read, which changes nothing that was sent.
   */
  private async readAfter(context: BotToolCallContext, sessionId: string): Promise<string> {
    let latest: LatestSessionEvents | undefined;
    try {
      latest = await this.queryBus.execute<FindLatestSessionEventsQuery, LatestSessionEvents>(
        new FindLatestSessionEventsQuery({ scope: context.owner, sessionId, limit: 1 }),
      );
    } catch {
      return '';
    }
    const seq = latest?.events.at(-1)?.seq;
    return seq === undefined
      ? ''
      : ` Its log was at entry ${seq}: read_session with after_seq ${seq} reads only what followed.`;
  }

  /** The session a call acts on, as a card offers to always allow the tool on it. */
  private async sessionSubject(context: BotToolCallContext, sessionId: string) {
    const session = await this.session(context, sessionId).catch(() => null);
    return { kind: 'session', key: sessionId, label: session?.name ?? `session ${sessionId}` };
  }

  private session(context: BotToolCallContext, sessionId: string): Promise<WorkSessionEntity> {
    return this.queryBus.execute<FindSessionQuery, WorkSessionEntity>(
      new FindSessionQuery({ scope: context.owner, sessionId }),
    );
  }

  /** The host's name as the owner sees it; its id when they cannot read it. */
  private async hostName(context: BotToolCallContext, hostId: string): Promise<string> {
    const overview = await this.queryBus
      .execute<FindHostQuery, { host: { name: string } }>(
        new FindHostQuery({ scope: context.owner, hostId }),
      )
      .catch(() => null);
    return overview?.host.name ?? `host ${hostId}`;
  }

  private project(context: BotToolCallContext, projectId: string): Promise<ProjectEntity> {
    return this.queryBus.execute<FindProjectQuery, ProjectEntity>(
      new FindProjectQuery({ scope: context.owner, projectId }),
    );
  }
}
