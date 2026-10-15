import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotApprovalStatus } from '@oppenheimer/shared';
import { BotApprovalOrmEntity } from './database/bot-approval.orm-entity';
import { BotApprovalEntity } from './domain/bot-approval.entity';
import { BotApprovalResponseDto } from './dtos/bot-approval.response.dto';

@Injectable()
export class BotApprovalMapper
  implements Mapper<BotApprovalEntity, BotApprovalOrmEntity, BotApprovalResponseDto>
{
  toPersistence(entity: BotApprovalEntity): BotApprovalOrmEntity {
    const record = new BotApprovalOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.turnId = entity.turnId;
    record.tool = entity.tool;
    record.input = entity.input;
    record.summary = entity.summary;
    record.status = entity.status;
    record.result = entity.result;
    record.note = entity.note;
    record.decidedByUserId = entity.decidedByUserId;
    record.decidedAt = entity.decidedAt;
    return record;
  }

  toDomain(record: BotApprovalOrmEntity): BotApprovalEntity {
    return BotApprovalEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        turnId: record.turnId,
        tool: record.tool,
        input: asInput(record.input),
        summary: record.summary,
        status: record.status as BotApprovalStatus,
        result: record.result,
        note: record.note,
        decidedByUserId: record.decidedByUserId,
        decidedAt: record.decidedAt,
      },
    });
  }

  toResponse(entity: BotApprovalEntity): BotApprovalResponseDto {
    const dto = new BotApprovalResponseDto();
    dto.id = entity.id;
    dto.turnId = entity.turnId;
    dto.tool = entity.tool;
    dto.input = entity.input;
    dto.summary = entity.summary;
    dto.status = entity.status;
    dto.result = entity.result;
    dto.note = entity.note;
    dto.decidedByUserId = entity.decidedByUserId;
    dto.decidedAt = entity.decidedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

/** The stored input, narrowed once: what the column holds is what the tool validated. */
function asInput(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}
