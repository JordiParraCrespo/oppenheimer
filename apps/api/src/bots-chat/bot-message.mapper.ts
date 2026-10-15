import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { BOT_EVENT_OUTCOMES, type BotMessageEvent, type BotMessageRole } from '@oppenheimer/shared';
import { BotMessageOrmEntity } from './database/bot-message.orm-entity';
import { BotMessageEntity, type BotToolStep } from './domain/bot-message.entity';
import type { SummarizableMessage } from './domain/bot-summary.policy';
import { ENDED_TURN_STATUSES } from './domain/bot-turn.entity';
import { BotMessageResponseDto } from './dtos/bot-message.response.dto';

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
    }));
    record.position = entity.position;
    record.event = entity.event ? { ...entity.event } : null;
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
    }));
    dto.event = entity.event ? { ...entity.event } : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /** A stored message as the summary weighs it, with whether its turn (in `turnStatus`) has ended. */
  toSummarizable(record: BotMessageOrmEntity, turnStatus: unknown): SummarizableMessage {
    const message = this.toDomain(record);
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      turnEnded: ENDED_TURN_STATUSES.some((status) => status === turnStatus),
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
  };
}

/** A stored event, narrowed once; anything the mapper did not write reads as none. */
function toEvent(raw: Record<string, unknown> | null): BotMessageEvent | null {
  if (raw?.kind !== 'approval') return null;
  const outcome = BOT_EVENT_OUTCOMES.find((known) => known === raw.outcome);
  if (!outcome) return null;
  return {
    kind: 'approval',
    outcome,
    tool: String(raw.tool ?? ''),
    summary: String(raw.summary ?? ''),
  };
}
