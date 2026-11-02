import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotToolDecision } from '@oppenheimer/shared';
import { BotToolPermissionOrmEntity } from './database/bot-tool-permission.orm-entity';
import { BotToolPermissionEntity } from './domain/bot-tool-permission.entity';
import type { BotPermissionsView } from './domain/bot-tool-permission.policy';
import {
  type BotPermissionRuleDto,
  BotPermissionsResponseDto,
  BotToolGrantDto,
  BotToolPermissionDto,
} from './dtos/bot-permissions.response.dto';

@Injectable()
export class BotToolPermissionMapper
  implements Mapper<BotToolPermissionEntity, BotToolPermissionOrmEntity, BotToolGrantDto>
{
  toPersistence(entity: BotToolPermissionEntity): BotToolPermissionOrmEntity {
    const record = new BotToolPermissionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.tool = entity.tool;
    record.decision = entity.decision;
    record.subjectKind = entity.subject?.kind ?? null;
    record.subjectKey = entity.subject?.key ?? null;
    record.subjectLabel = entity.subject?.label ?? null;
    record.createdByUserId = entity.createdByUserId;
    return record;
  }

  toDomain(record: BotToolPermissionOrmEntity): BotToolPermissionEntity {
    return BotToolPermissionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        tool: record.tool,
        decision: record.decision as BotToolDecision,
        subject:
          record.subjectKind && record.subjectKey && record.subjectLabel
            ? { kind: record.subjectKind, key: record.subjectKey, label: record.subjectLabel }
            : null,
        createdByUserId: record.createdByUserId,
      },
    });
  }

  /** A grant as Settings lists it; only rows with a subject are grants. */
  toResponse(entity: BotToolPermissionEntity): BotToolGrantDto {
    const dto = new BotToolGrantDto();
    dto.id = entity.id;
    dto.tool = entity.tool;
    dto.subjectKind = entity.subject?.kind ?? '';
    dto.subjectLabel = entity.subject?.label ?? '';
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /** Settings → Permissions as one response; the rules as their own mapper writes them. */
  toPermissionsResponse(
    view: BotPermissionsView,
    rules: BotPermissionRuleDto[],
  ): BotPermissionsResponseDto {
    const dto = new BotPermissionsResponseDto();
    dto.preset = view.preset;
    dto.tools = view.rows.map((row) => Object.assign(new BotToolPermissionDto(), row));
    dto.grants = view.grants.map((grant) => this.toResponse(grant));
    dto.rules = rules;
    return dto;
  }
}
