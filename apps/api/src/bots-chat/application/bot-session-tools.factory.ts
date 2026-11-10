import { Injectable } from '@nestjs/common';
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
import { answerNeedsPerson, SESSION_UNBLOCK_RULE } from '../domain/bot-session-decision.policy';
import { modelChoicesByAgent } from '../domain/bot-session-launch.policy';
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
} from './bot-tool.factory';

/** How long `start_cloud_session` waits for the cloud session's id: the runner's own start limit. */
const CLOUD_START_WAIT_MAX_SECONDS = 120;

/**
 * Sessions, the writes (`25-bots.md` §4.2): start a coding agent on a host
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
  .describe(
    "Start it hidden from the person's sidebar in the console (default false): for work they need not watch. It runs like any other, and they can show hidden sessions whenever they want.",
  );

@Injectable()
export class BotSessionToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'sessions' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly watches: BotSessionWatchResolver,
    private readonly waits: BotSessionWaitResolver,
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
      description:
        "Starts a coding agent (Claude Code by default) on a host with a task: in a new worktree of one of a project's repositories, or in a folder already on the host. Use it for work that needs a shell or a checkout, as \"Working on code through sessions\" says; it returns at once with the session's id, and the agent works on its own. If the host is offline the answer says the session is queued: report it as queued, not running. You are subscribed to it unless watch is false. The host defaults to the project's default host, then your home host.",
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
        model: z
          .string()
          .trim()
          .min(1)
          .max(128)
          .optional()
          .describe(
            `The agent's model, by id or by name as the person said it. ${modelChoicesByAgent()} A model the agent does not have is refused with the list it has.`,
          ),
        effort: z
          .enum(SESSION_EFFORTS)
          .optional()
          .describe(
            "How hard the model thinks, as the CLI names it (low, medium, high, xhigh, max; Codex also minimal and ultra). The model's own default when omitted; a level the model does not offer is refused with the ones it does.",
          ),
        permission: z
          .enum(SESSION_PERMISSIONS)
          .optional()
          .describe(
            'What the agent may do without asking: auto (default; approve for me, still checking each action), full (no checks at all, only when the person asks for it; the person always approves such a session on its own card), or ask (it stops at every approval, which the person or answer_session must answer).',
          ),
        base_branch: z
          .string()
          .trim()
          .min(1)
          .max(255)
          .optional()
          .describe(
            "The branch the session's own branch starts from; the repository's base branch when omitted. Not with folder.",
          ),
        name: z.string().min(1).max(80).optional().describe('A short name for the session.'),
        hidden: HIDDEN_SESSION_INPUT,
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
          ? ' The host is offline: the session is queued and starts when it comes back.'
          : '';
        const watched =
          input.watch === false
            ? 'You are not watching it; read it later with get_session.'
            : await this.watches.follow(context, result.sessionId, 'first_task');
        return {
          content: `Started session ${result.sessionId} on host ${hostId}.${offline} The agent works on its own. ${watched}`,
          sessionId: result.sessionId,
        };
      },
    });
  }

  /**
   * A session in a vendor's cloud, started the one way the product starts
   * each: Claude Code's or Codex's through the sessions' own create with
   * `cloud`, which has the host's runner run `claude --cloud` or `codex cloud
   * exec` in a scratch checkout and report the session it started; a
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
      description:
        "Starts a coding agent in a vendor's cloud with a task on one of a project's repositories, so it runs on the vendor's machines, not on a host. agent picks the cloud: claude-code (default; claude.ai/code) or codex (chatgpt.com/codex) are started by a host whose claude or codex CLI is signed in, and that account runs it; cursor is launched at Cursor on the person's own Cursor key (Settings → Cloud agents), bills their Cursor plan and takes no host. Use it when the person asks for a cloud session, or for work that should not hold a host. It returns the session's URL at the vendor once it exists: an answer with no link is not a start (still starting, queued on an offline host, or failed, most often because the host's CLI is not signed in; read_session says why). A cloud session's conversation stays at its vendor, so read_session_transcript cannot read it; follow it at its link and with get_session. You are subscribed to it unless watch is false. A cursor session takes follow-ups with send_to_session once its run ends; a claude-code or codex one takes follow-ups and answers at its vendor, not with send_to_session or answer_session. A host defaults to the project's default host, then your home host.",
      input: z.object({
        task: z
          .string()
          .trim()
          .min(FIELD_BOUNDS.prompt.min)
          .max(FIELD_BOUNDS.prompt.maxBytes)
          .refine(fitsPromptBound, {
            message: `Too long: at most ${FIELD_BOUNDS.prompt.maxBytes} bytes (UTF-8). Write a shorter brief; the agent can read the repository for the rest.`,
          })
          .describe(
            `What the cloud agent should do: it starts with only this. At most ${FIELD_BOUNDS.prompt.maxBytes} bytes.`,
          ),
        project_id: z
          .uuid()
          .describe('The project whose repository it works on (from list_projects).'),
        repository: z
          .string()
          .max(200)
          .optional()
          .describe(
            "owner/name of one of the project's repositories; its default one when omitted.",
          ),
        agent: z
          .enum(CLOUD_SESSION_AGENTS)
          .optional()
          .describe('Which cloud: claude-code when omitted, codex, or cursor.'),
        host_id: z
          .uuid()
          .optional()
          .describe(
            'claude-code and codex only: the host that starts it (from list_hosts); its CLI account runs the session.',
          ),
        codex_environment: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            'codex only: the Codex cloud environment, by id or label; the one linked to the repository when omitted.',
          ),
        model: z
          .string()
          .trim()
          .min(1)
          .max(128)
          .optional()
          .describe("cursor only: one of Cursor's models; Cursor's own pick when omitted."),
        name: z.string().min(1).max(80).optional().describe('A short name for the session.'),
        hidden: HIDDEN_SESSION_INPUT,
        watch: z
          .boolean()
          .optional()
          .describe('Be woken when its task needs input, ends or fails (default true).'),
        wait_seconds: z
          .number()
          .int()
          .min(0)
          .max(CLOUD_START_WAIT_MAX_SECONDS)
          .default(60)
          .describe(
            "How long to wait for the session's link at its vendor before answering without it.",
          ),
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
        const watched =
          input.watch === false
            ? 'You are not watching it; read it later with get_session.'
            : await this.watches.follow(context, sessionId, 'first_task');
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
      description:
        "Types a follow-up prompt into a running session's agent, as a person would at its prompt: more instructions, a correction, the next step. Only while the agent waits at its prompt (get_session's group idle or ready-for-review); while it works the prompt is refused, so end your turn and let your watch wake you when it is back at its prompt; when it asks a question or a permission, use answer_session. Nothing is queued: a refused prompt is not sent later. A Cursor cloud session takes it as a new run once its last run ended; a Claude Code or Codex cloud session takes none (it is answered at its vendor). The session's log records the prompt as yours, and the answer gives the entry it was sent at: read_session with that after_seq shows what followed, and read_session_transcript shows the agent's own words. You are subscribed to the task it starts unless watch is false.",
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
        const sent = await this.commandBus.execute<SendSessionPromptCommand, SessionCommandResult>(
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
            : await this.watches.follow(context, input.session_id, { turn });
        return `Sent the prompt to session ${input.session_id}. ${watched}${readAfterHint(sent.seq)}`;
      },
    });
  }

  private answerSession(): BotToolDefinition {
    return defineBotTool({
      name: 'answer_session',
      scope: 'sessions:write',
      asks: true,
      // Letting a destructive dialog through is the person's call alone: a
      // card of its own, under Full access and past every grant. A decision
      // that cannot be read is not taken as safe: it goes to the card too.
      escalates: async (input, context) => {
        const session = await this.session(context, input.session_id).catch(() => null);
        if (!session) return true;
        return answerNeedsPerson(session.pendingDecision, {
          decisionId: input.decision_id,
          option: input.option,
        });
      },
      subject: (input, context) => this.sessionSubject(context, input.session_id),
      description: `Answers what a session's agent is waiting on, so it carries on: a question it asked (answers, one per question, picks by index and/or words of your own) or a permission dialog (option, by index). get_session shows the decision, its id and its options. Use it to unblock a session rather than sending the person to it. ${SESSION_UNBLOCK_RULE} Afterwards get_session shows whether the decision cleared. You are subscribed to the task you unblocked unless watch is false.`,
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
        watch: z
          .boolean()
          .optional()
          .describe(
            'Be woken when the task you unblocked needs input again or ends (default true).',
          ),
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
        const watched =
          input.watch === false
            ? 'get_session shows what it does next.'
            : await this.watches.follow(context, input.session_id, 'now');
        return `Answered session ${input.session_id}. The agent takes it from here. ${watched}${readAfterHint(answered.seq)}`;
      },
    });
  }

  private stopSession(): BotToolDefinition {
    return this.sessionAction({
      name: 'stop_session',
      verb: 'stop',
      description:
        "Stops a running session's agent. The worktree and its changes are kept. Use it when the person asks to stop one, or for a session you started that went wrong. It stops once its host hears it: get_session shows when it has.",
      input: z.object({
        session_id: z.uuid().describe('The session to stop (from list_sessions).'),
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
      description:
        "Closes a session you started (a bot's session), most often one that failed or that you no longer need, so it leaves the person's sidebar: its agent ends, each branch is pushed and the worktree is removed. A session the person, an automation or a review started is refused: tell the person instead. Work never pushed is kept, and the close refused by the host, unless accept_unpushed_work is true; only set it when the person said the work can go. A failed session that never started has nothing to lose. It closes once its host hears it: get_session shows when it has.",
      input: z.object({
        session_id: z.uuid().describe('The session to close (from list_sessions).'),
        accept_unpushed_work: z
          .boolean()
          .optional()
          .describe('Remove the worktree even with work never pushed (default false).'),
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
