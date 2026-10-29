import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  BOT_EVENT_OUTCOMES,
  BOT_GOAL_ACTIVITIES,
  BOT_IMAGE_MIME_TYPES,
  BOT_REPLY_OUTCOMES,
  BOT_ROUTINE_ACTIVITIES,
  BOT_SESSION_EVENT_STATES,
  BOT_SUBAGENT_PROGRESS_TASK_MAX,
  BOT_SUBAGENT_STATUSES,
  type BotAnsweredQuestion,
  type BotAttachment,
  type BotMailDraft,
  type BotMessageEvent,
  type BotMessageRole,
  type BotSubagentProgress,
  type BotSubagentRun,
  botMailDraftSchema,
} from '@oppenheimer/shared';
import { BotMessageOrmEntity } from './database/bot-message.orm-entity';
import { BotMessageEntity, type BotToolStep } from './domain/bot-message.entity';
import type { SummarizableMessage } from './domain/bot-summary.policy';
import { ENDED_TURN_STATUSES } from './domain/bot-turn.entity';
import { BotAttachmentResponseDto } from './dtos/bot-attachment.response.dto';
import {
  BotApprovalEventResponseDto,
  BotGoalEventResponseDto,
  type BotMessageEventResponseDto,
  BotMessageResponseDto,
  BotPeerMessageEventResponseDto,
  BotPeerReplyEventResponseDto,
  BotRoutineEventResponseDto,
  BotSessionEventResponseDto,
} from './dtos/bot-message.response.dto';

@Injectable()
export class BotMessageMapper
  implements Mapper<BotMessageEntity, BotMessageOrmEntity, BotMessageResponseDto>
{
  toPersistence(entity: BotMessageEntity): BotMessageOrmEntity {
    const record = new BotMessageOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.turnId = entity.turnId;
    record.role = entity.role;
    record.content = entity.content;
    record.steps = entity.steps.map((step) => ({
      callId: step.callId,
      name: step.name,
      input: step.input,
      output: step.output,
      isError: step.isError,
      sessionId: step.sessionId,
      subagents: step.subagents,
      allowedBy: step.allowedBy,
      mailDraft: step.mailDraft,
    }));
    record.position = entity.position;
    record.event = entity.event ? { ...entity.event } : null;
    record.attachments = entity.attachments.map((attachment) => ({ ...attachment }));
    return record;
  }

  toDomain(record: BotMessageOrmEntity): BotMessageEntity {
    return BotMessageEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        turnId: record.turnId,
        role: record.role as BotMessageRole,
        content: record.content,
        steps: (record.steps ?? []).map(toStep),
        position: record.position,
        event: toEvent(record.event),
        attachments: (record.attachments ?? []).flatMap(toAttachment),
      },
    });
  }

  toResponse(entity: BotMessageEntity): BotMessageResponseDto {
    const dto = new BotMessageResponseDto();
    dto.id = entity.id;
    dto.turnId = entity.turnId;
    dto.role = entity.role;
    dto.content = entity.content;
    dto.steps = entity.steps.map((step) => ({
      callId: step.callId,
      name: step.name,
      input: step.input,
      output: step.output,
      isError: step.isError,
      sessionId: step.sessionId,
      subagents: step.subagents,
      allowedBy: step.allowedBy,
      mailDraft: step.mailDraft,
    }));
    dto.event = entity.event ? toEventResponse(entity.event) : null;
    dto.attachments = entity.attachments.map((attachment) =>
      Object.assign(new BotAttachmentResponseDto(), attachment),
    );
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /**
   * A stored message as the summary weighs it, with whether its turn (in
   * `turnStatus`) has ended; a line outside any turn has none to wait for.
   */
  toSummarizable(record: BotMessageOrmEntity, turnStatus: unknown): SummarizableMessage {
    const message = this.toDomain(record);
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      turnEnded:
        message.turnId === null || ENDED_TURN_STATUSES.some((status) => status === turnStatus),
    };
  }
}

/** A stored step, narrowed once: what the column holds is what the mapper wrote. */
function toStep(raw: Record<string, unknown>): BotToolStep {
  return {
    callId: String(raw.callId ?? ''),
    name: String(raw.name ?? ''),
    input: raw.input ?? null,
    output: typeof raw.output === 'string' ? raw.output : null,
    isError: raw.isError === true,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    subagents: toSubagentRuns(raw.subagents),
    allowedBy: typeof raw.allowedBy === 'string' ? raw.allowedBy : null,
    mailDraft: toMailDraft(raw.mailDraft),
  };
}

/**
 * The draft a mail step holds, narrowed once: from the step's stored column,
 * or from the JSON its call's data carried. Anything else reads as none.
 */
export function toMailDraft(raw: unknown): BotMailDraft | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = botMailDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The runs a `delegate` step holds, narrowed once: from the step's stored
 * column, or from the JSON its call's data carried (a tool's data is
 * strings only). Anything else reads as none, and a run it cannot read is
 * dropped.
 */
export function toSubagentRuns(raw: unknown): BotSubagentRun[] | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.flatMap((item): BotSubagentRun[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const status = BOT_SUBAGENT_STATUSES.find((known) => known === row.status);
    if (!status || typeof row.task !== 'string') return [];
    return [
      {
        task: row.task,
        status,
        result: typeof row.result === 'string' ? row.result : '',
        toolCalls: Array.isArray(row.toolCalls)
          ? row.toolCalls.filter((name): name is string => typeof name === 'string')
          : [],
        inputTokens: count(row.inputTokens),
        outputTokens: count(row.outputTokens),
        durationMs: count(row.durationMs),
      },
    ];
  });
}

/**
 * A `delegate` child as the stream first tells of it: waiting, nothing
 * called, its task cut to the frame's limit with the mark inside it, so a
 * long task never makes the console drop the frame as malformed.
 */
export function toQueuedSubagentProgress(task: string): BotSubagentProgress {
  return {
    task:
      task.length > BOT_SUBAGENT_PROGRESS_TASK_MAX
        ? `${task.slice(0, BOT_SUBAGENT_PROGRESS_TASK_MAX - 1)}…`
        : task,
    state: 'queued',
    toolCalls: [],
    startedAt: null,
    durationMs: null,
  };
}

/** A stored count: a whole, non-negative number, else zero. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** A stored attachment, narrowed once; one the mapper did not write is dropped. */
/**
 * The images a `show_image` call stored, narrowed once from the JSON its
 * data carried (a tool's data is strings only). Anything else reads as none,
 * and an image it cannot read is dropped.
 */
export function toShownImages(raw: string | undefined): BotAttachment[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) =>
    item && typeof item === 'object' ? toAttachment(item as Record<string, unknown>) : [],
  );
}

function toAttachment(raw: Record<string, unknown>): BotAttachment[] {
  const mimeType = BOT_IMAGE_MIME_TYPES.find((known) => known === raw.mimeType);
  if (!mimeType || typeof raw.id !== 'string') return [];
  return [
    {
      id: raw.id,
      mimeType,
      sizeBytes: typeof raw.sizeBytes === 'number' ? raw.sizeBytes : 0,
      name: typeof raw.name === 'string' ? raw.name : '',
    },
  ];
}

/** An event as the response carries it: the kind it is, with that kind's fields only. */
function toEventResponse(event: BotMessageEvent): BotMessageEventResponseDto {
  switch (event.kind) {
    case 'approval':
      return Object.assign(new BotApprovalEventResponseDto(), event);
    case 'routine':
      return Object.assign(new BotRoutineEventResponseDto(), event);
    case 'bot_message':
      return Object.assign(new BotPeerMessageEventResponseDto(), event);
    case 'bot_reply':
      return Object.assign(new BotPeerReplyEventResponseDto(), event);
    case 'session':
      return Object.assign(new BotSessionEventResponseDto(), event);
    case 'goal':
      return Object.assign(new BotGoalEventResponseDto(), event);
  }
}

/** An answered card's questions and answers in words, narrowed once; anything else is dropped. */
function toAnsweredQuestions(raw: readonly unknown[]): BotAnsweredQuestion[] {
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { question, answer } = item as Record<string, unknown>;
    return typeof question === 'string' && typeof answer === 'string' ? [{ question, answer }] : [];
  });
}

/** A stored event, narrowed once; anything the mapper did not write reads as none. */
function toEvent(raw: Record<string, unknown> | null): BotMessageEvent | null {
  if (!raw) return null;
  if (raw.kind === 'approval') {
    const outcome = BOT_EVENT_OUTCOMES.find((known) => known === raw.outcome);
    if (!outcome) return null;
    return {
      kind: 'approval',
      outcome,
      tool: String(raw.tool ?? ''),
      summary: String(raw.summary ?? ''),
      sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
      ...(Array.isArray(raw.answers) && { answers: toAnsweredQuestions(raw.answers) }),
    };
  }
  if (raw.kind === 'routine') {
    const activity = BOT_ROUTINE_ACTIVITIES.find((known) => known === raw.activity);
    if (!activity || typeof raw.automationId !== 'string') return null;
    return {
      kind: 'routine',
      activity,
      automationId: raw.automationId,
      runId: typeof raw.runId === 'string' ? raw.runId : null,
      name: String(raw.name ?? ''),
      reason: typeof raw.reason === 'string' ? raw.reason : null,
    };
  }
  if (raw.kind === 'bot_message') {
    return {
      kind: 'bot_message',
      fromBotId: typeof raw.fromBotId === 'string' ? raw.fromBotId : null,
      fromBotName: String(raw.fromBotName ?? ''),
      expectsReply: raw.expectsReply === true,
    };
  }
  if (raw.kind === 'bot_reply') {
    const outcome = BOT_REPLY_OUTCOMES.find((known) => known === raw.outcome);
    if (!outcome) return null;
    return {
      kind: 'bot_reply',
      fromBotId: typeof raw.fromBotId === 'string' ? raw.fromBotId : null,
      fromBotName: String(raw.fromBotName ?? ''),
      outcome,
    };
  }
  if (raw.kind === 'session') {
    const state = BOT_SESSION_EVENT_STATES.find((known) => known === raw.state);
    if (!state || typeof raw.subscriptionId !== 'string' || typeof raw.sessionId !== 'string') {
      return null;
    }
    return {
      kind: 'session',
      subscriptionId: raw.subscriptionId,
      sessionId: raw.sessionId,
      sessionName: String(raw.sessionName ?? ''),
      turn: typeof raw.turn === 'number' ? raw.turn : 0,
      state,
      ...matchOf(raw.match),
    };
  }
  if (raw.kind === 'goal') {
    const activity = BOT_GOAL_ACTIVITIES.find((known) => known === raw.activity);
    if (!activity || typeof raw.goalId !== 'string') return null;
    return {
      kind: 'goal',
      activity,
      goalId: raw.goalId,
      objective: String(raw.objective ?? ''),
      step: typeof raw.step === 'number' ? raw.step : 0,
      limit: typeof raw.limit === 'number' ? raw.limit : 0,
      reason: typeof raw.reason === 'string' ? raw.reason : null,
    };
  }
  return null;
}

/** A stored match, narrowed once: a pattern and a positive count, or no `match` key at all. */
function matchOf(raw: unknown): { match?: { pattern: string; count: number } } {
  if (typeof raw !== 'object' || raw === null) return {};
  const { pattern, count } = raw as Record<string, unknown>;
  return typeof pattern === 'string' && typeof count === 'number' && count > 0
    ? { match: { pattern, count } }
    : {};
}
