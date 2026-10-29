import {
  type BotApprovalResponseDto,
  type BotAttachmentResponseDto,
  type BotConversationResponseDto,
  type BotDocumentResponseDto,
  type BotDocumentRevisionResponseDto,
  type BotGroupResponseDto,
  type BotMemoryFactResponseDto,
  type BotMessageResponseDto,
  type BotPlanWindowDto,
  type BotResponseDto,
  type BotRoutineResponseDto,
  type BotTurnPlanLimitsDto,
  type BotTurnResponseDto,
  type ChatgptLoginResponseDto,
  heyApiSdk,
  type ModelProviderCredentialResponseDto,
  type WorkspaceBotApprovalResponseDto,
} from '@oppenheimer/api-client';
import { AppError, MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import {
  BOT_EVENT_OUTCOMES,
  BOT_REPLY_OUTCOMES,
  BOT_SESSION_WAKE_STATES,
  type BotApprovalDecision,
  type BotAttachment,
  type BotDocumentName,
  type BotMessageEvent,
  type BotProvider,
  type BotSection,
} from '@oppenheimer/shared/schemas/bot';
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
  type UpdateBotInput,
} from './bot.entity';
import {
  BotApprovalEntity,
  BotConversationEntity,
  BotMessageEntity,
  type BotPlanLimits,
  type BotPlanWindow,
  type BotToolStep,
  BotTurnEntity,
  WorkspaceBotApprovalEntity,
} from './bot-conversation.entity';
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
    new Date(dto.createdAt),
    new Date(dto.updatedAt),
  );
}

function toMessage(dto: BotMessageResponseDto): BotMessageEntity {
  const steps: BotToolStep[] = dto.steps.map((step) => ({ ...step }));
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
      const state = BOT_SESSION_WAKE_STATES.find((candidate) => candidate === dto.state);
      return state
        ? {
            kind: 'session',
            subscriptionId: dto.subscriptionId,
            sessionId: dto.sessionId,
            sessionName: dto.sessionName,
            turn: dto.turn,
            state,
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
  );
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
  @MapApiError(BotsErrors.FETCH_CONVERSATION_FAILED)
  async findConversation(id: string): Promise<BotConversationEntity> {
    const data = await unwrapBody(
      heyApiSdk.findBotConversation({ path: { id } }),
      BotsErrors.FETCH_CONVERSATION_FAILED,
    );
    return toConversation(data);
  }

  /**
   * The whole chat, oldest first, for an export: the chat's own read holds
   * only the newest. The API sends one message per line, and each is handed
   * on as it arrives, so the conversation is never held here as a whole.
   */
  @MapApiError(BotsErrors.EXPORT_CONVERSATION_FAILED)
  async exportConversation(id: string): Promise<AsyncIterable<BotMessageEntity>> {
    const body = await unwrapBody(
      heyApiSdk.exportBotConversation({ path: { id }, parseAs: 'stream' }),
      BotsErrors.EXPORT_CONVERSATION_FAILED,
    );
    return readMessages(body as unknown as ReadableStream<Uint8Array>);
  }

  /** Clear history: the chat is erased; soul, instructions and memory stay. */
  @MapApiError(BotsErrors.CLEAR_CONVERSATION_FAILED)
  async clearConversation(id: string): Promise<void> {
    await unwrap(
      heyApiSdk.clearBotConversation({ path: { id } }),
      BotsErrors.CLEAR_CONVERSATION_FAILED,
    );
  }

  /**
   * Says `content` to the bot, with the images uploaded for it
   * (`uploadImage`): a turn, queued behind any it has not finished. The
   * browser's time zone goes with it, so the bot tells the time where you are.
   */
  @MapApiError(BotsErrors.SEND_FAILED)
  async sendMessage(
    id: string,
    content: string,
    attachmentIds: readonly string[] = [],
  ): Promise<BotTurnEntity> {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const data = await unwrapBody(
      heyApiSdk.sendBotMessage({
        path: { id },
        body: { content, attachmentIds: [...attachmentIds], timeZone },
      }),
      BotsErrors.SEND_FAILED,
    );
    return toTurn(data);
  }

  /** An image picked for a message, stored until it is sent; the API judges its bytes. */
  @MapApiError(BotsErrors.UPLOAD_IMAGE_FAILED)
  async uploadImage(id: string, file: Blob): Promise<BotAttachment> {
    return toAttachment(
      await unwrapBody(
        heyApiSdk.uploadBotAttachment({ path: { id }, body: { file } }),
        BotsErrors.UPLOAD_IMAGE_FAILED,
      ),
    );
  }

  /** An image's bytes, for the chat to draw: the API serves them only to whoever may see them. */
  @MapApiError(BotsErrors.READ_IMAGE_FAILED)
  async readImage(id: string, attachmentId: string): Promise<Blob> {
    const body = await unwrapBody(
      heyApiSdk.readBotAttachment({ path: { id, attachmentId }, parseAs: 'blob' }),
      BotsErrors.READ_IMAGE_FAILED,
    );
    return body as unknown as Blob;
  }

  /** Stop: a queued turn ends now, a running one at its next step. */
  @MapApiError(BotsErrors.STOP_FAILED)
  async cancelTurn(id: string, turnId: string): Promise<BotTurnEntity> {
    const data = await unwrapBody(
      heyApiSdk.cancelBotTurn({ path: { id, turnId } }),
      BotsErrors.STOP_FAILED,
    );
    return toTurn(data);
  }

  /** The workspace's pending cards across the bots the caller may read, newest first. */
  @MapApiError(BotsErrors.FETCH_APPROVALS_FAILED)
  async findWorkspacePendingApprovals(): Promise<WorkspaceBotApprovalEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findWorkspaceBotApprovals({ query: { status: 'pending' } }),
      BotsErrors.FETCH_APPROVALS_FAILED,
    );
    return data.map(toWorkspaceApproval);
  }

  /** The card the bot waits on, if any: at most one is pending. */
  @MapApiError(BotsErrors.FETCH_APPROVALS_FAILED)
  async findPendingApproval(id: string): Promise<BotApprovalEntity | null> {
    const data = await unwrapBody(
      heyApiSdk.findBotApprovals({ path: { id }, query: { status: 'pending' } }),
      BotsErrors.FETCH_APPROVALS_FAILED,
    );
    return data[0] ? toApproval(data[0]) : null;
  }

  /**
   * Answers a card: `approve` runs the call the bot asked for, `deny` runs
   * nothing; either way the bot is told, with the note, and reports back.
   */
  @MapApiError(BotsErrors.DECIDE_APPROVAL_FAILED)
  async decideApproval(
    id: string,
    approvalId: string,
    decision: BotApprovalDecision,
    note?: string,
  ): Promise<BotApprovalEntity> {
    const data = await unwrapBody(
      heyApiSdk.decideBotApproval({
        path: { id, approvalId },
        body: { decision, ...(note?.trim() ? { note: note.trim() } : {}) },
      }),
      BotsErrors.DECIDE_APPROVAL_FAILED,
    );
    return toApproval(data);
  }

  /** The chat, live, not dialled yet: the caller subscribes, then `open()`s it. */
  openStream(id: string): BotStream {
    return new BotStream({ apiBaseUrl: this.apiBaseUrl, botId: id });
  }

  @MapApiError(BotsErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<BotEntity[]> {
    const data = await unwrapBody(heyApiSdk.findBots(), BotsErrors.FETCH_LIST_FAILED);
    return data.map(toBot);
  }

  @MapApiError(BotsErrors.FETCH_FAILED)
  async findById(id: string): Promise<BotEntity> {
    const data = await unwrapBody(heyApiSdk.findBot({ path: { id } }), BotsErrors.FETCH_FAILED);
    return toBot(data);
  }

  /**
   * A blank bot: the next free first name ("Juno", "Milo"…), ungrouped, on
   * the workspace's default provider, shown in `sections` beside Employees.
   */
  @MapApiError(BotsErrors.SAVE_FAILED)
  async create(sections?: BotSection[]): Promise<BotEntity> {
    const data = await unwrapBody(
      heyApiSdk.createBot({ body: { sections } }),
      BotsErrors.SAVE_FAILED,
    );
    return toBot(data);
  }

  @MapApiError(BotsErrors.SAVE_FAILED)
  async update(id: string, input: UpdateBotInput): Promise<BotEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBot({ path: { id }, body: input }),
      BotsErrors.SAVE_FAILED,
    );
    return toBot(data);
  }

  @MapApiError(BotsErrors.DELETE_FAILED)
  async remove(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteBot({ path: { id } }), BotsErrors.DELETE_FAILED);
  }

  @MapApiError(BotsErrors.FETCH_GROUPS_FAILED)
  async findGroups(): Promise<BotGroupEntity[]> {
    const data = await unwrapBody(heyApiSdk.findBotGroups(), BotsErrors.FETCH_GROUPS_FAILED);
    return data.map(toGroup);
  }

  @MapApiError(BotsErrors.SAVE_GROUP_FAILED)
  async createGroup(name: string): Promise<BotGroupEntity> {
    const data = await unwrapBody(
      heyApiSdk.createBotGroup({ body: { name } }),
      BotsErrors.SAVE_GROUP_FAILED,
    );
    return toGroup(data);
  }

  @MapApiError(BotsErrors.SAVE_GROUP_FAILED)
  async renameGroup(id: string, name: string): Promise<BotGroupEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBotGroup({ path: { id }, body: { name } }),
      BotsErrors.SAVE_GROUP_FAILED,
    );
    return toGroup(data);
  }

  /** Its bots stay, ungrouped. */
  @MapApiError(BotsErrors.DELETE_GROUP_FAILED)
  async removeGroup(id: string): Promise<void> {
    await unwrap(heyApiSdk.deleteBotGroup({ path: { id } }), BotsErrors.DELETE_GROUP_FAILED);
  }

  /** Both documents, soul first. */
  @MapApiError(BotsErrors.FETCH_DOCUMENTS_FAILED)
  async findDocuments(id: string): Promise<BotDocumentEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotDocuments({ path: { id } }),
      BotsErrors.FETCH_DOCUMENTS_FAILED,
    );
    return data.map(toDocument);
  }

  /**
   * A new revision over `baseRevision`. A save over a newer one is refused
   * with `BOTS_006`, carrying the revision it is at
   * ({@link documentConflictRevision}).
   */
  @MapApiError(BotsErrors.SAVE_DOCUMENT_FAILED)
  async saveDocument(
    id: string,
    name: BotDocumentName,
    input: SaveBotDocumentInput,
  ): Promise<BotDocumentEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBotDocument({ path: { id, name }, body: input }),
      BotsErrors.SAVE_DOCUMENT_FAILED,
    );
    return toDocument(data);
  }

  /** Newest first. */
  @MapApiError(BotsErrors.FETCH_REVISIONS_FAILED)
  async findRevisions(id: string, name: BotDocumentName): Promise<BotDocumentRevisionEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotDocumentRevisions({ path: { id, name } }),
      BotsErrors.FETCH_REVISIONS_FAILED,
    );
    return data.map(toRevision);
  }

  /** Writes that revision's content as the next revision; nothing in the history is lost. */
  @MapApiError(BotsErrors.REVERT_FAILED)
  async revert(id: string, name: BotDocumentName, revision: number): Promise<BotDocumentEntity> {
    const data = await unwrapBody(
      heyApiSdk.revertBotDocument({ path: { id, name, revision } }),
      BotsErrors.REVERT_FAILED,
    );
    return toDocument(data);
  }

  /** A bot's routines, oldest first (`26-bot-routines.md` §7). */
  @MapApiError(BotsErrors.FETCH_ROUTINES_FAILED)
  async findRoutines(id: string): Promise<BotRoutineEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotRoutines({ path: { id } }),
      BotsErrors.FETCH_ROUTINES_FAILED,
    );
    return data.map(toRoutine);
  }

  /** Every bot's routines in the workspace, oldest first, for `/automations`. */
  @MapApiError(BotsErrors.FETCH_ROUTINES_FAILED)
  async findAllRoutines(): Promise<BotRoutineEntity[]> {
    const data = await unwrapBody(heyApiSdk.findRoutines(), BotsErrors.FETCH_ROUTINES_FAILED);
    return data.map(toRoutine);
  }

  /** The tab's switch: off pauses the routine's triggers, on resumes them from now. */
  @MapApiError(BotsErrors.SAVE_ROUTINE_FAILED)
  async setRoutineEnabled(id: string, routineId: string, enabled: boolean): Promise<void> {
    await unwrap(
      heyApiSdk.updateBotRoutine({ path: { id, routineId }, body: { enabled } }),
      BotsErrors.SAVE_ROUTINE_FAILED,
    );
  }

  /** Run now: one run, paused or not. */
  @MapApiError(BotsErrors.RUN_ROUTINE_FAILED)
  async runRoutine(id: string, routineId: string, idempotencyKey: string): Promise<void> {
    await unwrap(
      heyApiSdk.runBotRoutine({
        path: { id, routineId },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
      BotsErrors.RUN_ROUTINE_FAILED,
    );
  }

  @MapApiError(BotsErrors.DELETE_ROUTINE_FAILED)
  async deleteRoutine(id: string, routineId: string): Promise<void> {
    await unwrap(
      heyApiSdk.deleteBotRoutine({ path: { id, routineId } }),
      BotsErrors.DELETE_ROUTINE_FAILED,
    );
  }

  @MapApiError(BotsErrors.FETCH_MEMORY_FAILED)
  async findMemory(id: string): Promise<BotMemoryFactEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findBotMemory({ path: { id } }),
      BotsErrors.FETCH_MEMORY_FAILED,
    );
    return data.map(toFact);
  }

  @MapApiError(BotsErrors.SAVE_FACT_FAILED)
  async addFact(id: string, content: string): Promise<BotMemoryFactEntity> {
    const data = await unwrapBody(
      heyApiSdk.createBotMemoryFact({ path: { id }, body: { content } }),
      BotsErrors.SAVE_FACT_FAILED,
    );
    return toFact(data);
  }

  @MapApiError(BotsErrors.SAVE_FACT_FAILED)
  async updateFact(id: string, factId: string, content: string): Promise<BotMemoryFactEntity> {
    const data = await unwrapBody(
      heyApiSdk.updateBotMemoryFact({ path: { id, factId }, body: { content } }),
      BotsErrors.SAVE_FACT_FAILED,
    );
    return toFact(data);
  }

  @MapApiError(BotsErrors.DELETE_FACT_FAILED)
  async removeFact(id: string, factId: string): Promise<void> {
    await unwrap(
      heyApiSdk.deleteBotMemoryFact({ path: { id, factId } }),
      BotsErrors.DELETE_FACT_FAILED,
    );
  }

  @MapApiError(BotsErrors.CLEAR_MEMORY_FAILED)
  async clearMemory(id: string): Promise<void> {
    await unwrap(heyApiSdk.clearBotMemory({ path: { id } }), BotsErrors.CLEAR_MEMORY_FAILED);
  }

  @MapApiError(BotsErrors.FETCH_PROVIDERS_FAILED)
  async findModelProviders(): Promise<ModelProviderEntity[]> {
    const data = await unwrapBody(
      heyApiSdk.findModelProviderCredentials(),
      BotsErrors.FETCH_PROVIDERS_FAILED,
    );
    return data.map(toProvider);
  }

  /** Stores the workspace's key for `provider`, replacing the one there. The key is never read back. */
  @MapApiError(BotsErrors.SAVE_PROVIDER_KEY_FAILED)
  async putModelProviderKey(provider: BotProvider, apiKey: string): Promise<void> {
    await unwrap(
      heyApiSdk.putModelProviderCredential({ path: { provider }, body: { apiKey } }),
      BotsErrors.SAVE_PROVIDER_KEY_FAILED,
    );
  }

  /** Makes `provider`, which must have a key, the one new bots start on. */
  @MapApiError(BotsErrors.SET_DEFAULT_PROVIDER_FAILED)
  async setDefaultModelProvider(provider: BotProvider): Promise<void> {
    await unwrap(
      heyApiSdk.setDefaultModelProvider({ path: { provider } }),
      BotsErrors.SET_DEFAULT_PROVIDER_FAILED,
    );
  }

  @MapApiError(BotsErrors.DELETE_PROVIDER_KEY_FAILED)
  async removeModelProviderKey(provider: BotProvider): Promise<void> {
    await unwrap(
      heyApiSdk.deleteModelProviderCredential({ path: { provider } }),
      BotsErrors.DELETE_PROVIDER_KEY_FAILED,
    );
  }

  /** Asks ChatGPT for a device code for the workspace's sign-in. Nothing is stored yet. */
  @MapApiError(BotsErrors.START_CHATGPT_LOGIN_FAILED)
  async startChatgptLogin(): Promise<ChatgptLoginEntity> {
    const data = await unwrapBody(
      heyApiSdk.startChatgptLogin(),
      BotsErrors.START_CHATGPT_LOGIN_FAILED,
    );
    return toChatgptLogin(data);
  }

  /** One poll of a sign-in: `connected` once the person approved it and the API stored it. */
  @MapApiError(BotsErrors.POLL_CHATGPT_LOGIN_FAILED)
  async pollChatgptLogin(flowId: string): Promise<Exclude<ChatgptLoginState, 'expired'>> {
    const data = await unwrapBody(
      heyApiSdk.pollChatgptLogin({ body: { flowId } }),
      BotsErrors.POLL_CHATGPT_LOGIN_FAILED,
    );
    return data.status;
  }
}
