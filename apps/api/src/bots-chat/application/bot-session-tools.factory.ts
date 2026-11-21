import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FIELD_BOUNDS, fitsPromptBound } from '@oppenheimer/shared';
import { CODING_AGENT_IDS, SESSION_EFFORTS, SESSION_PERMISSIONS } from '@oppenheimer/shared/agents';
import { z } from 'zod/v4';
import { FindHostQuery } from '../../hosts/queries/find-host/find-host.query';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import { AnswerSessionDecisionCommand } from '../../sessions/commands/answer-session-decision/answer-session-decision.command';
import { CloseSessionCommand } from '../../sessions/commands/close-session/close-session.command';
import { CreateSessionCommand } from '../../sessions/commands/create-session/create-session.command';
import { SendSessionPromptCommand } from '../../sessions/commands/send-session-prompt/send-session-prompt.command';
import { StartCloudSessionCommand } from '../../sessions/commands/start-cloud-session/start-cloud-session.command';
import { StopSessionCommand } from '../../sessions/commands/stop-session/stop-session.command';
import type { SessionCommandResult } from '../../sessions/domain/session-command.types';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../sessions/queries/find-session/find-session.query';
import {
  closeSummary,
  decisionAnswerOf,
  decisionAnswerSummary,
  planSession,
  promptSummary,
  readAfterHint,
  type SessionActionVerb,
  sentTurnOf,
  sessionActionAnswer,
  sessionHostId,
  sessionLaunchRefusal,
  sessionSummary,
} from '../bot-session-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { answerNeedsPerson, SESSION_UNBLOCK_RULE } from '../domain/bot-session-decision.policy';
import { modelChoicesByAgent } from '../domain/bot-session-launch.policy';
import { sessionLink } from '../domain/bot-session-link.policy';
import { botSessionRefusal } from '../domain/bot-session-ownership.policy';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import {
  CLOUD_SESSION_AGENTS,
  type CloudSessionPlan,
  cloudFieldRefusal,
  cloudSessionHostId,
  cloudSessionSummary,
  cloudStartAnswer,
  planCloudSession,
} from './bot-cloud-session.policy';
import { BotSessionWaitResolver } from './bot-session-wait.resolver';
import { BotSessionWatchResolver } from './bot-session-watch.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
  inChannel,
} from './bot-tool.factory';

/** How long `start_cloud_session` waits for the cloud session's id: the runner's own start limit. */
const CLOUD_START_WAIT_MAX_SECONDS = 120;

/**
 * Sessions, the writes: start a coding agent on a host
 * with a task, or in a vendor's cloud (Claude Code's or Codex's from a host,
 * Cursor's on the owner's key), give a running one a follow-up prompt or answer what it asks,
 * stop one, or close one it started. Each reaches outside Oppenheimer (they run things on the
 * owner's machine), so under Approve for me they ask first, and each says on
 * the card what it will do, by name. A bot's session is the owner's, started
 * in their scope, marked `bot`; a prompt it sends is logged as the bot's.
 */

/**
 * `start_session`'s and `start_cloud_session`'s `hidden`: one contract for
 * both, so the wording a bot reads cannot drift between them.
 */
const HIDDEN_SESSION_INPUT = z
  .boolean()
  .optional()
  .describe(promptText('tools/sessions.hidden-session'));

@Injectable()
export class BotSessionToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly watches: BotSessionWatchResolver,
    private readonly waits: BotSessionWaitResolver,
    private readonly config: ConfigService,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.startSession(),
      this.startCloudSession(),
      this.sendToSession(),
      this.answerSession(),
      this.stopSession(),
      this.closeSession(),
    ];
  }

  private startSession(): BotToolDefinition {
    return defineBotTool({
      name: 'start_session',
      scope: 'sessions:write',
      asks: true,
      // A session at full access runs with every check off: the owner says yes
      // to that session alone, whatever they allowed start_session before.
      escalates: (input) => input.permission === 'full',
      subject: async (input, context) => {
        if (!input.project_id) return null;
        const project = await this.project(context, input.project_id).catch(() => null);
        return {
          kind: 'project',
          key: input.project_id,
          label: project?.name ?? `project ${input.project_id}`,
        };
      },
      description: promptText('tools/sessions.start-session'),
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
            message: promptText('tools/sessions.start-session-task-message', {
              maxBytes: String(FIELD_BOUNDS.prompt.maxBytes),
            }),
          })
          .describe(
            promptText('tools/sessions.start-session-task', {
              maxBytes: String(FIELD_BOUNDS.prompt.maxBytes),
            }),
          ),
        project_id: z
          .uuid()
          .optional()
          .describe(promptText('tools/sessions.start-session-project-id')),
        repository: z
          .string()
          .max(200)
          .optional()
          .describe(promptText('tools/sessions.start-session-repository')),
        folder: z
          .string()
          .max(1_024)
          .optional()
          .describe(promptText('tools/sessions.start-session-folder')),
        host_id: z.uuid().optional().describe(promptText('tools/sessions.start-session-host-id')),
        agent: z
          .enum(CODING_AGENT_IDS)
          .optional()
          .describe(promptText('tools/sessions.start-session-agent')),
        model: z
          .string()
          .trim()
          .min(1)
          .max(128)
          .optional()
          .describe(
            promptText('tools/sessions.start-session-model', {
              modelChoicesByAgent: modelChoicesByAgent(),
            }),
          ),
        effort: z
          .enum(SESSION_EFFORTS)
          .optional()
          .describe(promptText('tools/sessions.start-session-effort')),
        permission: z
          .enum(SESSION_PERMISSIONS)
          .optional()
          .describe(promptText('tools/sessions.start-session-permission')),
        base_branch: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .optional()
          .describe(promptText('tools/sessions.start-session-base-branch')),
        name: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe(promptText('tools/sessions.start-session-name')),
        hidden: HIDDEN_SESSION_INPUT,
        watch: z.boolean().optional().describe(promptText('tools/sessions.start-session-watch')),
      }),
      summarize: async (input, context) => {
        // A project the owner cannot read still gets a card, naming it by id: the call says why.
        const project = input.project_id
          ? await this.project(context, input.project_id).catch(() => null)
          : null;
        // A launch the agent does not take is refused here, before it interrupts the owner with a card.
        const refusal = sessionLaunchRefusal(input, project);
        if (refusal) throw new BotToolRefusal(refusal);
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
          ? ` ${promptText('tools/sessions.start-session-host-offline-session')}`
          : '';
        const watched = await this.watches.follow(
          context,
          result.sessionId,
          'first_task',
          input.watch,
        );
        const started = promptText('tools/sessions.start-session-content', {
          sessionId: result.sessionId,
          hostId,
          offline,
          watched,
        });
        const link = inChannel(context)
          ? ` ${promptText('tools/sessions.start-session-channel-link', {
              link: sessionLink(
                this.config.getOrThrow<string>('app.frontendUrl'),
                result.sessionId,
              ),
            })}`
          : '';
        return { content: `${started}${link}`, sessionId: result.sessionId };
      },
    });
  }

  /**
   * A session in a vendor's cloud, started the one way the product starts
   * each: Claude Code's or Codex's through the sessions' own create with
   * `cloud`, which has the host's runner run `claude --cloud` in a scratch
   * checkout or start a thread in Codex cloud, and report the session it started; a
   * vendor's (Cursor's) through `StartCloudSessionCommand`, on the owner's
   * own key with no host. Same scope, card and owner's scope as
   * `start_session`; it hands back the session's URL at the vendor.
   */
  private startCloudSession(): BotToolDefinition {
    return defineBotTool({
      name: 'start_cloud_session',
      scope: 'sessions:write',
      asks: true,
      subject: async (input, context) => {
        const project = await this.project(context, input.project_id).catch(() => null);
        return {
          kind: 'project',
          key: input.project_id,
          label: project?.name ?? `project ${input.project_id}`,
        };
      },
      description: promptText('tools/sessions.start-cloud-session'),
      input: z.object({
        task: z
          .string()
          .trim()
          .min(FIELD_BOUNDS.prompt.min)
          .max(FIELD_BOUNDS.prompt.maxBytes)
          .refine(fitsPromptBound, {
            message: promptText('tools/sessions.start-cloud-session-task-message', {
              maxBytes: String(FIELD_BOUNDS.prompt.maxBytes),
            }),
          })
          .describe(
            promptText('tools/sessions.start-cloud-session-task', {
              maxBytes: String(FIELD_BOUNDS.prompt.maxBytes),
            }),
          ),
        project_id: z.uuid().describe(promptText('tools/sessions.start-cloud-session-project-id')),
        repository: z
          .string()
          .max(200)
          .optional()
          .describe(promptText('tools/sessions.start-session-repository')),
        agent: z
          .enum(CLOUD_SESSION_AGENTS)
          .optional()
          .describe(promptText('tools/sessions.start-cloud-session-agent')),
        host_id: z
          .uuid()
          .optional()
          .describe(promptText('tools/sessions.start-cloud-session-host-id')),
        codex_environment: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(promptText('tools/sessions.start-cloud-session-codex-environment')),
        model: z
          .string()
          .trim()
          .min(1)
          .max(128)
          .optional()
          .describe(promptText('tools/sessions.start-cloud-session-model')),
        name: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe(promptText('tools/sessions.start-session-name')),
        hidden: HIDDEN_SESSION_INPUT,
        watch: z
          .boolean()
          .optional()
          .describe(promptText('tools/sessions.start-cloud-session-watch')),
        wait_seconds: z
          .number()
          .int()
          .min(0)
          .max(CLOUD_START_WAIT_MAX_SECONDS)
          .default(60)
          .describe(promptText('tools/sessions.start-cloud-session-wait-seconds')),
      }),
      summarize: async (input, context) => {
        const project = await this.project(context, input.project_id).catch(() => null);
        // A call that cannot start is refused here, before it interrupts the owner with a card.
        const plan = project ? planCloudSession(input, project, context.homeHostId) : null;
        const refusal = plan && 'refusal' in plan ? plan.refusal : cloudFieldRefusal(input);
        if (refusal) throw new BotToolRefusal(refusal);
        const hostId = cloudSessionHostId(input, project, context.homeHostId);
        const host = hostId ? await this.hostName(context, hostId) : null;
        return cloudSessionSummary(input, project, host);
      },
      run: async (input, context, signal) => {
        const project = await this.project(context, input.project_id);
        const plan = planCloudSession(input, project, context.homeHostId);
        if ('refusal' in plan) throw new BotToolRefusal(plan.refusal);
        const result = await this.commandBus.execute<
          CreateSessionCommand | StartCloudSessionCommand,
          SessionCommandResult
        >(cloudSessionCommand(plan, context));
        const { sessionId } = result;
        const session = result.hints.includes('host_offline')
          ? null
          : await this.waits.cloudStart(context, sessionId, input.wait_seconds, signal);
        const watched = await this.watches.follow(context, sessionId, 'first_task', input.watch);
        return { content: `${cloudStartAnswer(plan, sessionId, session)} ${watched}`, sessionId };
      },
    });
  }

  private sendToSession(): BotToolDefinition {
    return defineBotTool({
      name: 'send_to_session',
      scope: 'sessions:write',
      asks: true,
      subject: (input, context) => this.sessionSubject(context, input.session_id),
      description: promptText('tools/sessions.send-to-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/sessions.send-to-session-session-id')),
        text: z
          .string()
          .trim()
          .min(FIELD_BOUNDS.prompt.min)
          .max(FIELD_BOUNDS.prompt.maxBytes)
          .refine(fitsPromptBound, {
            message: promptText('tools/sessions.send-to-session-text-message', {
              maxBytes: String(FIELD_BOUNDS.prompt.maxBytes),
            }),
          })
          .describe(
            promptText('tools/sessions.send-to-session-text', {
              maxBytes: String(FIELD_BOUNDS.prompt.maxBytes),
            }),
          ),
        watch: z.boolean().optional().describe(promptText('tools/sessions.send-to-session-watch')),
      }),
      summarize: async (input, context) =>
        promptSummary(input, await this.session(context, input.session_id)),
      run: async (input, context) => {
        // Read first: the prompt opens the next task, or joins the live one.
        const turn = sentTurnOf((await this.session(context, input.session_id)).latestTurn);
        const sent = await this.commandBus.execute<SendSessionPromptCommand, SessionCommandResult>(
          new SendSessionPromptCommand({
            scope: context.owner,
            sessionId: input.session_id,
            text: input.text,
            sender: { kind: 'bot', botId: context.botId, turnId: context.turnId },
          }),
        );
        const watched = await this.watches.follow(context, input.session_id, { turn }, input.watch);
        return promptText('tools/sessions.send-to-session-sent-prompt-session', {
          sessionId: input.session_id,
          watched,
          readAfterHint: readAfterHint(sent.seq),
        });
      },
    });
  }

  private answerSession(): BotToolDefinition {
    return defineBotTool({
      name: 'answer_session',
      scope: 'sessions:write',
      asks: true,
      // Who answers is `answerNeedsPerson`'s: the bot under Full access; the
      // person, past every grant, for a destructive or unread one otherwise.
      escalates: async (input, context) =>
        answerNeedsPerson(
          await this.session(context, input.session_id).catch(() => null),
          { decisionId: input.decision_id, option: input.option },
          context.permission,
        ),
      subject: (input, context) => this.sessionSubject(context, input.session_id),
      description: promptText('tools/sessions.answer-session', {
        sessionUnblockRule: SESSION_UNBLOCK_RULE,
      }),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/sessions.answer-session-session-id')),
        decision_id: z
          .string()
          .min(1)
          .max(128)
          .describe(promptText('tools/sessions.answer-session-decision-id')),
        answers: z
          .array(
            z.object({
              picks: z
                .array(z.number().int().min(0))
                .max(6)
                .default([])
                .describe(promptText('tools/sessions.answer-session-answers-picks')),
              other: z
                .string()
                .max(1_000)
                .optional()
                .describe(promptText('tools/sessions.answer-session-answers-other')),
            }),
          )
          .min(1)
          .max(4)
          .optional()
          .describe(promptText('tools/sessions.answer-session-answers')),
        option: z
          .number()
          .int()
          .min(0)
          .max(8)
          .optional()
          .describe(promptText('tools/sessions.answer-session-option')),
        watch: z.boolean().optional().describe(promptText('tools/sessions.answer-session-watch')),
      }),
      summarize: async (input, context) => {
        const summary = decisionAnswerSummary(input, await this.session(context, input.session_id));
        if ('refusal' in summary) throw new BotToolRefusal(summary.refusal);
        return summary.line;
      },
      run: async (input, context) => {
        if ((input.answers === undefined) === (input.option === undefined)) {
          throw new BotToolRefusal(
            promptText('tools/sessions.answer-session-give-answers-question'),
          );
        }
        // Read first: the task answered, so its end wakes the bot even if it comes before the watch.
        const task = (await this.session(context, input.session_id)).latestTurn;
        const answered = await this.commandBus.execute<
          AnswerSessionDecisionCommand,
          SessionCommandResult
        >(
          new AnswerSessionDecisionCommand({
            scope: context.owner,
            sessionId: input.session_id,
            answer: decisionAnswerOf(input),
          }),
        );
        const watched = await this.watches.follow(
          context,
          input.session_id,
          task ? { answered: task.seq } : 'now',
          input.watch,
        );
        return promptText('tools/sessions.answer-session-answered-session-agent', {
          sessionId: input.session_id,
          watched,
          readAfterHint: readAfterHint(answered.seq),
        });
      },
    });
  }

  private stopSession(): BotToolDefinition {
    return this.sessionAction({
      name: 'stop_session',
      verb: 'stop',
      description: promptText('tools/sessions.stop-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/sessions.stop-session-session-id')),
      }),
      summary: (session) => `Stop the session "${session.name}" (${session.id})`,
      command: (input, context) =>
        new StopSessionCommand({ scope: context.owner, sessionId: input.session_id }),
    });
  }

  /**
   * Closes a session a bot started, most often one that failed, so it does not
   * stay in the owner's sidebar: the sessions' own close, which pushes each
   * branch and removes the worktrees. Whose sessions a bot may close is
   * `botSessionRefusal`'s.
   */
  private closeSession(): BotToolDefinition {
    return this.sessionAction({
      name: 'close_session',
      verb: 'close',
      description: promptText('tools/sessions.close-session'),
      input: z.object({
        session_id: z.uuid().describe(promptText('tools/sessions.close-session-session-id')),
        accept_unpushed_work: z
          .boolean()
          .optional()
          .describe(promptText('tools/sessions.close-session-accept-unpushed-work')),
      }),
      refusal: botSessionRefusal,
      doneHere: (session) => session.closesWithoutItsHost,
      summary: (session, input) => closeSummary(session, input.accept_unpushed_work === true),
      command: (input, context) =>
        new CloseSessionCommand({
          scope: context.owner,
          sessionId: input.session_id,
          acceptUnpushedWork: input.accept_unpushed_work === true,
        }),
    });
  }

  /**
   * A tool that ends something about one session (stop, close): it asks
   * first, the card names the session, `refusal` turns a session it may not
   * touch away before any card and again when an approved call runs, the
   * sessions' own command does the work, and the answer says whether it is
   * done or waits on the host.
   */
  private sessionAction<Input extends z.ZodObject<{ session_id: z.ZodUUID }>>(spec: {
    name: string;
    verb: SessionActionVerb;
    description: string;
    input: Input;
    refusal?: (session: WorkSessionEntity) => string | null;
    /** Whether the command finishes here, with no host to wait for. */
    doneHere?: (session: WorkSessionEntity) => boolean;
    summary: (session: WorkSessionEntity, input: z.output<Input>) => string;
    command: (
      input: z.output<Input>,
      context: BotToolCallContext,
    ) => StopSessionCommand | CloseSessionCommand;
  }): BotToolDefinition {
    const allowed = async (context: BotToolCallContext, sessionId: string) => {
      const session = await this.session(context, sessionId);
      const refusal = spec.refusal?.(session);
      if (refusal) throw new BotToolRefusal(refusal);
      return session;
    };
    return defineBotTool({
      name: spec.name,
      scope: 'sessions:write',
      asks: true,
      subject: (input, context) => this.sessionSubject(context, input.session_id),
      description: spec.description,
      input: spec.input,
      summarize: async (input, context) =>
        spec.summary(await allowed(context, input.session_id), input),
      run: async (input, context) => {
        const session = await allowed(context, input.session_id);
        const result = await this.commandBus.execute<
          StopSessionCommand | CloseSessionCommand,
          SessionCommandResult
        >(spec.command(input, context));
        return sessionActionAnswer({
          verb: spec.verb,
          sessionId: input.session_id,
          hints: result.hints,
          doneHere: spec.doneHere?.(session) ?? false,
        });
      },
    });
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

/** The sessions' own command that starts what a cloud plan says, as the owner, marked as the bot's. */
function cloudSessionCommand(
  plan: CloudSessionPlan,
  context: BotToolCallContext & { approvalId?: string },
): CreateSessionCommand | StartCloudSessionCommand {
  const props = {
    scope: context.owner,
    userId: context.owner.userId,
    idempotencyKey: idempotencyKeyOf(context.turnId, plan.body, context.approvalId),
    origin: 'bot' as const,
  };
  return plan.kind === 'host'
    ? new CreateSessionCommand({ ...props, input: plan.body })
    : new StartCloudSessionCommand({ ...props, input: plan.body });
}
