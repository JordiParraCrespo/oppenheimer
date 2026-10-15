import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotMessageRole } from '@oppenheimer/shared';
import { BotMessageOrmEntity } from './database/bot-message.orm-entity';
import { BotMessageEntity, type BotToolStep } from './domain/bot-message.entity';
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
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
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
