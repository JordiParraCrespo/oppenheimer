import {
  type BotApprovalResponseDto,
  type BotAttachmentResponseDto,
  type BotConversationResponseDto,
  type BotDocumentResponseDto,
  type BotDocumentRevisionResponseDto,
  type BotGroupResponseDto,
  type BotMemoryFactResponseDto,
  type BotMessageResponseDto,
  type BotPermissionsResponseDto,
  type BotPlanWindowDto,
  type BotQuestionResponseDto,
  type BotResponseDto,
  type BotRoutineResponseDto,
  type BotTurnPlanLimitsDto,
  type BotTurnResponseDto,
  type ChatgptLoginResponseDto,
  heyApiSdk,
  type ModelProviderCredentialResponseDto,
  type WorkspaceBotApprovalResponseDto,
} from '@oppenheimer/api-client';
import { AppError, callApi } from '@oppenheimer/frontend-core';
import {
  BOT_APPROVAL_DECISIONS,
  BOT_EVENT_OUTCOMES,
  BOT_GOAL_ACTIVITIES,
  BOT_QUESTION_OUTCOMES,
  BOT_REPLY_OUTCOMES,
  BOT_SESSION_EVENT_STATES,
  type BotApprovalDecision,
  type BotAttachment,
  type BotDocumentName,
  type BotGoal,
  type BotMessageEvent,
  type BotPermissionRuleEffect,
  type BotProvider,
  type BotQuestionAnswer,
  type BotSection,
  type BotToolDecision,
} from '@oppenheimer/shared/schemas/bot';
import {
  type BotMailDraft,
  botMailDraftSchema,
  type MailPlan,
  mailPlanSchema,
} from '@oppenheimer/shared/schemas/mail';
import { inject, injectable, optional } from 'inversify';
import { TOKENS } from '../../di/tokens';
import { triggerOf } from '../automations/automations.repository';
import {
  BotDocumentEntity,
  BotDocumentRevisionEntity,
  BotEntity,
  BotGroupEntity,
  BotMemoryFactEntity,
  BotRoutineEntity,
  ChatgptLoginEntity,
  type ChatgptLoginState,
  ModelProviderEntity,
  type SaveBotDocumentInput,
  type UpdateBotFactInput,
  type UpdateBotInput,
} from './bot.entity';
import {
  BotApprovalEntity,
  BotConversationEntity,
  BotMessageEntity,
  type BotPlanLimits,
  type BotPlanWindow,
  BotQuestionCardEntity,
  type BotToolStep,
  BotTurnEntity,
  WorkspaceBotApprovalEntity,
} from './bot-conversation.entity';
import { BotPermissionsEntity } from './bot-permissions.entity';
import { BotsErrors } from './bots.errors';
import { readNdjson } from './ndjson';
import { BotStream } from './stream/bot-stream';

function toBot(dto: BotResponseDto): BotEntity {
  return new BotEntity(
    dto.id,
    dto.name,
    dto.description,
    dto.avatarColor,
    dto.groupId,
    dto.position,
    dto.homeHostId,
    dto.provider,
    dto.model,
    dto.effort,
    dto.permission,
    dto.learnAutomatically,
    new Date(dto.createdAt),
    new Date(dto.updatedAt),
    new Date(dto.lastActivityAt),
    dto.lastMessagePreview,
    dto.sections,
  );
}

function toProvider(dto: ModelProviderCredentialResponseDto): ModelProviderEntity {
  return new ModelProviderEntity(
    dto.provider,
    dto.configured,
    dto.keyHint,
    dto.updatedAt ? new Date(dto.updatedAt) : null,
    dto.isDefault,
  );
}

function toChatgptLogin(dto: ChatgptLoginResponseDto): ChatgptLoginEntity {
  return new ChatgptLoginEntity(
    dto.flowId,
    dto.userCode,
    dto.verificationUrl,
    dto.intervalSeconds,
    new Date(dto.expiresAt),
  );
}

function toGroup(dto: BotGroupResponseDto): BotGroupEntity {
  return new BotGroupEntity(dto.id, dto.name, dto.position, new Date(dto.createdAt));
}

function toDocument(dto: BotDocumentResponseDto): BotDocumentEntity {
  return new BotDocumentEntity(
    dto.name,
    dto.content,
    dto.revision,
    dto.updatedBy,
    new Date(dto.updatedAt),
  );
}

function toRevision(dto: BotDocumentRevisionResponseDto): BotDocumentRevisionEntity {
  return new BotDocumentRevisionEntity(
    dto.id,
    dto.name,
    dto.revision,
    dto.content,
    dto.author,
    dto.note,
    dto.revertedFrom,
    new Date(dto.createdAt),
  );
}

function toRoutine(dto: BotRoutineResponseDto): BotRoutineEntity {
  return new BotRoutineEntity(
    dto.id,
    dto.botId,
    dto.name,
    dto.prompt,
    dto.status,
    dto.pausedReason != null,
    dto.nextRunAt ? new Date(dto.nextRunAt) : null,
    dto.triggers.flatMap((trigger) => triggerOf(trigger) ?? []),
    dto.lastRun ? { status: dto.lastRun.status, createdAt: new Date(dto.lastRun.createdAt) } : null,
    new Date(dto.updatedAt),
  );
}

function toFact(dto: BotMemoryFactResponseDto): BotMemoryFactEntity {
  return new BotMemoryFactEntity(
    dto.id,
    dto.content,
    dto.source,
    dto.tier,
    dto.scope,
    dto.botId,
    new Date(dto.createdAt),
    new Date(dto.updatedAt),
  );
}

function toMessage(dto: BotMessageResponseDto): BotMessageEntity {
  const steps: BotToolStep[] = dto.steps.map((step) => ({
    ...step,
    mailDraft: draftOf(step.mailDraft),
  }));
  return new BotMessageEntity(
    dto.id,
    dto.turnId,
    dto.role,
    dto.content,
    steps,
    new Date(dto.createdAt),
    dto.event ? toEvent(dto.event) : null,
    (dto.attachments ?? []).map(toAttachment),
  );
}

function toAttachment(dto: BotAttachmentResponseDto): BotAttachment {
  return { id: dto.id, mimeType: dto.mimeType, sizeBytes: dto.sizeBytes, name: dto.name };
}

/**
 * The wire's event as the union the chat draws from, kind by kind: an
 * approval, a routine's activity, a message from another bot, or the answer
 * to an ask, or a session the bot follows waking it. An outcome or a state
 * this client does not know reads as no event, and the chat falls back to
 * the message's first line.
 */
function toEvent(dto: NonNullable<BotMessageResponseDto['event']>): BotMessageEvent | null {
  switch (dto.kind) {
    case 'approval': {
      const outcome = BOT_EVENT_OUTCOMES.find((candidate) => candidate === dto.outcome);
      return outcome
        ? {
            kind: 'approval',
            outcome,
            tool: dto.tool,
            summary: dto.summary,
            sessionId: dto.sessionId ?? null,
            ...(dto.approvalId && { approvalId: dto.approvalId }),
          }
        : null;
    }
    case 'question': {
      const outcome = BOT_QUESTION_OUTCOMES.find((candidate) => candidate === dto.outcome);
      return outcome
        ? {
            kind: 'question',
            outcome,
            summary: dto.summary,
            answers: dto.answers.map((answer) => ({ ...answer })),
          }
        : null;
    }
    case 'routine':
      return {
        kind: 'routine',
        activity: dto.activity,
        automationId: dto.automationId,
        runId: dto.runId ?? null,
        name: dto.name,
        reason: dto.reason ?? null,
      };
    case 'bot_message':
      return {
        kind: 'bot_message',
        fromBotId: dto.fromBotId ?? null,
        fromBotName: dto.fromBotName,
        expectsReply: dto.expectsReply,
      };
    case 'bot_reply': {
      const outcome = BOT_REPLY_OUTCOMES.find((candidate) => candidate === dto.outcome);
      return outcome
        ? {
            kind: 'bot_reply',
            fromBotId: dto.fromBotId ?? null,
            fromBotName: dto.fromBotName,
            outcome,
          }
        : null;
    }
    case 'session': {
      const state = BOT_SESSION_EVENT_STATES.find((candidate) => candidate === dto.state);
      return state
        ? {
            kind: 'session',
            subscriptionId: dto.subscriptionId,
            sessionId: dto.sessionId,
            sessionName: dto.sessionName,
            turn: dto.turn,
            state,
            match: dto.match ? { pattern: dto.match.pattern, count: dto.match.count } : null,
          }
        : null;
    }
    case 'goal': {
      const activity = BOT_GOAL_ACTIVITIES.find((candidate) => candidate === dto.activity);
      return activity
        ? {
            kind: 'goal',
            activity,
            goalId: dto.goalId,
            objective: dto.objective,
            step: dto.step,
            limit: dto.limit,
            reason: dto.reason,
          }
        : null;
    }
  }
}

function toTurn(dto: BotTurnResponseDto): BotTurnEntity {
  return new BotTurnEntity(
    dto.id,
    dto.status,
    dto.provider,
    dto.model,
    dto.error,
    dto.inputTokens,
    dto.outputTokens,
    dto.cancelRequested,
    new Date(dto.createdAt),
    dto.startedAt ? new Date(dto.startedAt) : null,
    dto.endedAt ? new Date(dto.endedAt) : null,
    dto.contextTokens === null ? null : { tokens: dto.contextTokens, window: dto.contextWindow },
    dto.planLimits ? toPlanLimits(dto.planLimits) : null,
    dto.failure,
  );
}

function toPlanLimits(dto: BotTurnPlanLimitsDto): BotPlanLimits {
  const window = (w: BotPlanWindowDto | null): BotPlanWindow | null =>
    w ? { usedPercent: w.usedPercent, resetsAt: w.resetsAt ? new Date(w.resetsAt) : null } : null;
  return { fiveHour: window(dto.fiveHour), sevenDay: window(dto.sevenDay) };
}

function toApproval(dto: BotApprovalResponseDto): BotApprovalEntity {
  return new BotApprovalEntity(
    dto.id,
    dto.turnId,
    dto.tool,
    dto.summary,
    dto.status,
    dto.result,
    new Date(dto.createdAt),
    {
      input: dto.input,
      subjectLabel: dto.subjectLabel,
      sharesOutside: dto.sharesOutside,
      reviewNote: dto.reviewNote,
      reaches: dto.reaches,
      reach: dto.reach,
      decisions: dto.availableDecisions.filter((decision) =>
        BOT_APPROVAL_DECISIONS.includes(decision),
      ),
    },
    mailOf(dto.tool, dto.input),
  );
}

function toQuestionCard(dto: BotQuestionResponseDto): BotQuestionCardEntity {
  return new BotQuestionCardEntity(
    dto.id,
    dto.turnId,
    dto.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    })),
    dto.summary,
    dto.status,
    new Date(dto.createdAt),
  );
}

function toPermissions(dto: BotPermissionsResponseDto): BotPermissionsEntity {
  return new BotPermissionsEntity(
    dto.preset,
    dto.tools.map((tool) => ({ ...tool })),
    dto.grants.map((grant) => ({ ...grant, createdAt: new Date(grant.createdAt) })),
    dto.rules.map((rule) => ({ ...rule, createdAt: new Date(rule.createdAt) })),
  );
}

/** A mail call's saved draft; one that does not read as one draws no card. */
function draftOf(raw: unknown): BotMailDraft | null {
  const parsed = botMailDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The tools whose card stores the message it sends, as `input.plan`. */
const SENDING_TOOLS = new Set(['send_mail', 'send_draft']);

/** A send card's message; a plan that does not read as one draws the card's words alone. */
function mailOf(tool: string, input: Record<string, unknown>): MailPlan | null {
  if (!SENDING_TOOLS.has(tool)) return null;
  const parsed = mailPlanSchema.safeParse(input.plan);
  return parsed.success ? parsed.data : null;
}

function toWorkspaceApproval(dto: WorkspaceBotApprovalResponseDto): WorkspaceBotApprovalEntity {
  return new WorkspaceBotApprovalEntity(
    toApproval(dto),
    dto.botId,
    dto.botName,
    dto.sessionId,
    dto.input,
  );
}

/** The export's lines as messages; a line that cannot be read fails the export. */
async function* readMessages(body: ReadableStream<Uint8Array>): AsyncIterable<BotMessageEntity> {
  try {
    for await (const line of readNdjson(body)) yield toMessage(line as BotMessageResponseDto);
  } catch (error) {
    throw new AppError(BotsErrors.EXPORT_CONVERSATION_FAILED, { cause: error });
  }
}

function toConversation(dto: BotConversationResponseDto): BotConversationEntity {
  return new BotConversationEntity(
    dto.messages.map(toMessage),
    dto.turns.map(toTurn),
    dto.messageCount,
    dto.storedTextBlocks,
  );
}

/**
 * The workspace's bots, their sidebar groups, their two documents and what
 * they remember (`product/versions/mvp/25-bots.md`, slice 1). Every call is
 * the API's; nothing here holds a rule of its own, so there is no service.
 */
@injectable()
export class BotsRepository {
  constructor(
    @inject(TOKENS.ApiBaseUrl)
    @optional()
    private readonly apiBaseUrl: string = '',
  ) {}

  /** The newest messages of the chat, oldest first, and their turns. */
  findConversation(id: string): Promise<BotConversationEntity> {
    return callApi(BotsErrors.FETCH_CONVERSATION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotConversation({ path: { id } }));
      return toConversation(data);
    });
  }

  /**
   * The whole chat, oldest first, for an export: the chat's own read holds
   * only the newest. The API sends one message per line, and each is handed
   * on as it arrives, so the conversation is never held here as a whole.
   */
  exportConversation(id: string): Promise<AsyncIterable<BotMessageEntity>> {
    return callApi(BotsErrors.EXPORT_CONVERSATION_FAILED, async (api) => {
      const body = await api.body(
        heyApiSdk.exportBotConversation({ path: { id }, parseAs: 'stream' }),
      );
      return readMessages(body as unknown as ReadableStream<Uint8Array>);
    });
  }

  /** Clear history: the chat is erased; soul, instructions and memory stay. */
  clearConversation(id: string): Promise<void> {
    return callApi(BotsErrors.CLEAR_CONVERSATION_FAILED, async (api) => {
      await api.result(heyApiSdk.clearBotConversation({ path: { id } }));
    });
  }

  /**
   * Says `content` to the bot, with the images uploaded for it
   * (`uploadImage`): a turn, queued behind any it has not finished. The
   * browser's time zone goes with it, so the bot tells the time where you are.
   */
  sendMessage(
    id: string,
    content: string,
    attachmentIds: readonly string[] = [],
  ): Promise<BotTurnEntity> {
    return callApi(BotsErrors.SEND_FAILED, async (api) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const data = await api.body(
        heyApiSdk.sendBotMessage({
          path: { id },
          body: { content, attachmentIds: [...attachmentIds], timeZone },
        }),
      );
      return toTurn(data);
    });
  }

  /** An image picked for a message, stored until it is sent; the API judges its bytes. */
  uploadImage(id: string, file: Blob): Promise<BotAttachment> {
    return callApi(BotsErrors.UPLOAD_IMAGE_FAILED, async (api) => {
      return toAttachment(
        await api.body(heyApiSdk.uploadBotAttachment({ path: { id }, body: { file } })),
      );
    });
  }

  /** An image's bytes, for the chat to draw: the API serves them only to whoever may see them. */
  readImage(id: string, attachmentId: string): Promise<Blob> {
    return callApi(BotsErrors.READ_IMAGE_FAILED, async (api) => {
      const body = await api.body(
        heyApiSdk.readBotAttachment({ path: { id, attachmentId }, parseAs: 'blob' }),
      );
      return body as unknown as Blob;
    });
  }

  /** Stop: a queued turn ends now, a running one at its next step. */
  cancelTurn(id: string, turnId: string): Promise<BotTurnEntity> {
    return callApi(BotsErrors.STOP_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.cancelBotTurn({ path: { id, turnId } }));
      return toTurn(data);
    });
  }

  /** The workspace's pending cards across the bots the caller may read, newest first. */
  findWorkspacePendingApprovals(): Promise<WorkspaceBotApprovalEntity[]> {
    return callApi(BotsErrors.FETCH_APPROVALS_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.findWorkspaceBotApprovals({ query: { status: 'pending' } }),
      );
      return data.map(toWorkspaceApproval);
    });
  }

  /** The goal the bot set itself and keeps working toward; null when it has none. */
  findGoal(id: string): Promise<BotGoal | null> {
    return callApi(BotsErrors.FETCH_GOAL_FAILED, async (api) => {
      const { goal } = await api.body(heyApiSdk.findBotGoal({ path: { id } }));
      return goal;
    });
  }

  /** Stops the bot's goal: no more continuation turns, and one still waiting is cancelled. */
  clearGoal(id: string): Promise<void> {
    return callApi(BotsErrors.CLEAR_GOAL_FAILED, async (api) => {
      await api.result(heyApiSdk.clearBotGoal({ path: { id } }));
    });
  }

  /** The card the bot waits on, if any: at most one is pending. */
  findPendingApproval(id: string): Promise<BotApprovalEntity | null> {
    return callApi(BotsErrors.FETCH_APPROVALS_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.findBotApprovals({ path: { id }, query: { status: 'pending' } }),
      );
      return data[0] ? toApproval(data[0]) : null;
    });
  }

  /**
   * Answers a card with one of the decisions it offers: a yes runs the call
   * the bot asked for (and may stand for its subject or the tool), `deny`
   * runs nothing and the bot is told, with the note, and carries on; `stop`
   * runs nothing and ends the turn.
   */
  decideApproval(
    id: string,
    approvalId: string,
    decision: BotApprovalDecision,
    note?: string,
  ): Promise<BotApprovalEntity> {
    return callApi(BotsErrors.DECIDE_APPROVAL_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.decideBotApproval({
          path: { id, approvalId },
          body: { decision, ...(note?.trim() ? { note: note.trim() } : {}) },
        }),
      );
      return toApproval(data);
    });
  }

  /** The card of questions the bot waits on (`ask_user`); `null` when none does. */
  findPendingQuestion(id: string): Promise<BotQuestionCardEntity | null> {
    return callApi(BotsErrors.FETCH_QUESTION_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findPendingBotQuestion({ path: { id } }));
      return data.question ? toQuestionCard(data.question) : null;
    });
  }

  /** Answers a card of questions, one answer per question; the bot carries on with them. */
  answerQuestion(
    id: string,
    questionId: string,
    answers: readonly BotQuestionAnswer[],
  ): Promise<BotQuestionCardEntity> {
    return callApi(BotsErrors.ANSWER_QUESTION_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.answerBotQuestion({
          path: { id, questionId },
          body: { answers: answers.map((answer) => ({ ...answer, picks: [...answer.picks] })) },
        }),
      );
      return toQuestionCard(data);
    });
  }

  /** Declines a card of questions; the bot is told, and not to ask again. */
  dismissQuestion(id: string, questionId: string): Promise<BotQuestionCardEntity> {
    return callApi(BotsErrors.ANSWER_QUESTION_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.dismissBotQuestion({ path: { id, questionId }, body: {} }),
      );
      return toQuestionCard(data);
    });
  }

  /** The chat, live, not dialled yet: the caller subscribes, then `open()`s it. */
  openStream(id: string): BotStream {
    return new BotStream({ apiBaseUrl: this.apiBaseUrl, botId: id });
  }

  findAll(): Promise<BotEntity[]> {
    return callApi(BotsErrors.FETCH_LIST_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBots());
      return data.map(toBot);
    });
  }

  findById(id: string): Promise<BotEntity> {
    return callApi(BotsErrors.FETCH_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBot({ path: { id } }));
      return toBot(data);
    });
  }

  /**
   * A blank bot: the next free first name ("Juno", "Milo"…), ungrouped, on
   * the workspace's default provider, shown in `sections` beside Employees.
   */
  create(sections?: BotSection[]): Promise<BotEntity> {
    return callApi(BotsErrors.SAVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.createBot({ body: { sections } }));
      return toBot(data);
    });
  }

  update(id: string, input: UpdateBotInput): Promise<BotEntity> {
    return callApi(BotsErrors.SAVE_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.updateBot({ path: { id }, body: input }));
      return toBot(data);
    });
  }

  remove(id: string): Promise<void> {
    return callApi(BotsErrors.DELETE_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteBot({ path: { id } }));
    });
  }

  findGroups(): Promise<BotGroupEntity[]> {
    return callApi(BotsErrors.FETCH_GROUPS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotGroups());
      return data.map(toGroup);
    });
  }

  createGroup(name: string): Promise<BotGroupEntity> {
    return callApi(BotsErrors.SAVE_GROUP_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.createBotGroup({ body: { name } }));
      return toGroup(data);
    });
  }

  renameGroup(id: string, name: string): Promise<BotGroupEntity> {
    return callApi(BotsErrors.SAVE_GROUP_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.updateBotGroup({ path: { id }, body: { name } }));
      return toGroup(data);
    });
  }

  /** Its bots stay, ungrouped. */
  removeGroup(id: string): Promise<void> {
    return callApi(BotsErrors.DELETE_GROUP_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteBotGroup({ path: { id } }));
    });
  }

  /** Both documents, soul first. */
  findDocuments(id: string): Promise<BotDocumentEntity[]> {
    return callApi(BotsErrors.FETCH_DOCUMENTS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotDocuments({ path: { id } }));
      return data.map(toDocument);
    });
  }

  /**
   * A new revision over `baseRevision`. A save over a newer one is refused
   * with `BOTS_006`, carrying the revision it is at
   * ({@link documentConflictRevision}).
   */
  saveDocument(
    id: string,
    name: BotDocumentName,
    input: SaveBotDocumentInput,
  ): Promise<BotDocumentEntity> {
    return callApi(BotsErrors.SAVE_DOCUMENT_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.updateBotDocument({ path: { id, name }, body: input }));
      return toDocument(data);
    });
  }

  /** Newest first. */
  findRevisions(id: string, name: BotDocumentName): Promise<BotDocumentRevisionEntity[]> {
    return callApi(BotsErrors.FETCH_REVISIONS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotDocumentRevisions({ path: { id, name } }));
      return data.map(toRevision);
    });
  }

  /** Writes that revision's content as the next revision; nothing in the history is lost. */
  revert(id: string, name: BotDocumentName, revision: number): Promise<BotDocumentEntity> {
    return callApi(BotsErrors.REVERT_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.revertBotDocument({ path: { id, name, revision } }));
      return toDocument(data);
    });
  }

  /** A bot's routines, oldest first (`26-bot-routines.md` §7). */
  findRoutines(id: string): Promise<BotRoutineEntity[]> {
    return callApi(BotsErrors.FETCH_ROUTINES_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotRoutines({ path: { id } }));
      return data.map(toRoutine);
    });
  }

  /** Every bot's routines in the workspace, oldest first, for `/automations`. */
  findAllRoutines(): Promise<BotRoutineEntity[]> {
    return callApi(BotsErrors.FETCH_ROUTINES_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findRoutines());
      return data.map(toRoutine);
    });
  }

  /** The tab's switch: off pauses the routine's triggers, on resumes them from now. */
  setRoutineEnabled(id: string, routineId: string, enabled: boolean): Promise<void> {
    return callApi(BotsErrors.SAVE_ROUTINE_FAILED, async (api) => {
      await api.result(heyApiSdk.updateBotRoutine({ path: { id, routineId }, body: { enabled } }));
    });
  }

  /** Run now: one run, paused or not. */
  runRoutine(id: string, routineId: string, idempotencyKey: string): Promise<void> {
    return callApi(BotsErrors.RUN_ROUTINE_FAILED, async (api) => {
      await api.result(
        heyApiSdk.runBotRoutine({
          path: { id, routineId },
          headers: { 'Idempotency-Key': idempotencyKey },
        }),
      );
    });
  }

  deleteRoutine(id: string, routineId: string): Promise<void> {
    return callApi(BotsErrors.DELETE_ROUTINE_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteBotRoutine({ path: { id, routineId } }));
    });
  }

  findMemory(id: string): Promise<BotMemoryFactEntity[]> {
    return callApi(BotsErrors.FETCH_MEMORY_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotMemory({ path: { id } }));
      return data.map(toFact);
    });
  }

  addFact(id: string, content: string): Promise<BotMemoryFactEntity> {
    return callApi(BotsErrors.SAVE_FACT_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.createBotMemoryFact({ path: { id }, body: { content } }),
      );
      return toFact(data);
    });
  }

  updateFact(id: string, factId: string, change: UpdateBotFactInput): Promise<BotMemoryFactEntity> {
    return callApi(BotsErrors.SAVE_FACT_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.updateBotMemoryFact({ path: { id, factId }, body: change }),
      );
      return toFact(data);
    });
  }

  removeFact(id: string, factId: string): Promise<void> {
    return callApi(BotsErrors.DELETE_FACT_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteBotMemoryFact({ path: { id, factId } }));
    });
  }

  clearMemory(id: string): Promise<void> {
    return callApi(BotsErrors.CLEAR_MEMORY_FAILED, async (api) => {
      await api.result(heyApiSdk.clearBotMemory({ path: { id } }));
    });
  }

  findPermissions(id: string): Promise<BotPermissionsEntity> {
    return callApi(BotsErrors.FETCH_PERMISSIONS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findBotPermissions({ path: { id } }));
      return toPermissions(data);
    });
  }

  /** One tool's Allow, Ask or Off; `default` follows the preset again. */
  setToolDecision(
    id: string,
    tool: string,
    decision: BotToolDecision | 'default',
  ): Promise<BotPermissionsEntity> {
    return callApi(BotsErrors.SAVE_PERMISSION_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.setBotToolDecision({ path: { id, tool }, body: { decision } }),
      );
      return toPermissions(data);
    });
  }

  addPermissionRule(
    id: string,
    effect: BotPermissionRuleEffect,
    text: string,
  ): Promise<BotPermissionsEntity> {
    return callApi(BotsErrors.SAVE_PERMISSION_FAILED, async (api) => {
      const data = await api.body(
        heyApiSdk.createBotPermissionRule({ path: { id }, body: { effect, text } }),
      );
      return toPermissions(data);
    });
  }

  removePermissionRule(id: string, ruleId: string): Promise<void> {
    return callApi(BotsErrors.SAVE_PERMISSION_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteBotPermissionRule({ path: { id, ruleId } }));
    });
  }

  removeToolGrant(id: string, grantId: string): Promise<void> {
    return callApi(BotsErrors.SAVE_PERMISSION_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteBotToolGrant({ path: { id, grantId } }));
    });
  }

  findModelProviders(): Promise<ModelProviderEntity[]> {
    return callApi(BotsErrors.FETCH_PROVIDERS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findModelProviderCredentials());
      return data.map(toProvider);
    });
  }

  /** Stores the workspace's key for `provider`, replacing the one there. The key is never read back. */
  putModelProviderKey(provider: BotProvider, apiKey: string): Promise<void> {
    return callApi(BotsErrors.SAVE_PROVIDER_KEY_FAILED, async (api) => {
      await api.result(
        heyApiSdk.putModelProviderCredential({ path: { provider }, body: { apiKey } }),
      );
    });
  }

  /** Makes `provider`, which must have a key, the one new bots start on. */
  setDefaultModelProvider(provider: BotProvider): Promise<void> {
    return callApi(BotsErrors.SET_DEFAULT_PROVIDER_FAILED, async (api) => {
      await api.result(heyApiSdk.setDefaultModelProvider({ path: { provider } }));
    });
  }

  removeModelProviderKey(provider: BotProvider): Promise<void> {
    return callApi(BotsErrors.DELETE_PROVIDER_KEY_FAILED, async (api) => {
      await api.result(heyApiSdk.deleteModelProviderCredential({ path: { provider } }));
    });
  }

  /** Asks ChatGPT for a device code for the workspace's sign-in. Nothing is stored yet. */
  startChatgptLogin(): Promise<ChatgptLoginEntity> {
    return callApi(BotsErrors.START_CHATGPT_LOGIN_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.startChatgptLogin());
      return toChatgptLogin(data);
    });
  }

  /** One poll of a sign-in: `connected` once the person approved it and the API stored it. */
  pollChatgptLogin(flowId: string): Promise<Exclude<ChatgptLoginState, 'expired'>> {
    return callApi(BotsErrors.POLL_CHATGPT_LOGIN_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.pollChatgptLogin({ body: { flowId } }));
      return data.status;
    });
  }
}
