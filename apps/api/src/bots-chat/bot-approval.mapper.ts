import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  BOT_APPROVAL_REACHES,
  type BotApprovalReach,
  type BotApprovalStatus,
  SCOPES,
  type Scope,
} from '@oppenheimer/shared';
import { BotApprovalOrmEntity } from './database/bot-approval.orm-entity';
import { BotApprovalEntity } from './domain/bot-approval.entity';
import { BotApprovalResponseDto } from './dtos/bot-approval.response.dto';
import { WorkspaceBotApprovalResponseDto } from './dtos/workspace-bot-approval.response.dto';

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
    record.sessionId = entity.sessionId;
    record.note = entity.note;
    record.subjectKind = entity.subject?.kind ?? null;
    record.subjectKey = entity.subject?.key ?? null;
    record.subjectLabel = entity.subject?.label ?? null;
    record.sharesOutside = entity.sharesOutside;
    record.perCallOnly = entity.perCallOnly;
    record.reviewNote = entity.reviewNote;
    record.reach = entity.reach;
    record.decidedByUserId = entity.decidedByUserId;
    record.decidedWithScopes = entity.decidedWithScopes ? [...entity.decidedWithScopes] : null;
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
        sessionId: record.sessionId,
        note: record.note,
        subject:
          record.subjectKind && record.subjectKey && record.subjectLabel
            ? { kind: record.subjectKind, key: record.subjectKey, label: record.subjectLabel }
            : null,
        sharesOutside: record.sharesOutside ?? false,
        perCallOnly: record.perCallOnly ?? false,
        reviewNote: record.reviewNote ?? null,
        reach: asReach(record.reach),
        decidedByUserId: record.decidedByUserId,
        decidedWithScopes: asScopes(record.decidedWithScopes),
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
    dto.subjectKind = entity.subject?.kind ?? null;
    dto.subjectLabel = entity.subject?.label ?? null;
    dto.sharesOutside = entity.sharesOutside;
    dto.reviewNote = entity.reviewNote;
    dto.reaches = entity.reaches;
    dto.availableDecisions = entity.availableDecisions;
    dto.reach = entity.reach;
    dto.decidedByUserId = entity.decidedByUserId;
    dto.decidedAt = entity.decidedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }

  /** The card read across the workspace's bots, with the name of the bot that asked. */
  toWorkspaceResponse(entity: BotApprovalEntity, botName: string): WorkspaceBotApprovalResponseDto {
    const dto = Object.assign(new WorkspaceBotApprovalResponseDto(), this.toResponse(entity));
    dto.botId = entity.botId;
    dto.botName = botName;
    dto.sessionId = entity.sessionId;
    return dto;
  }
}

/** The stored input, narrowed once: what the column holds is what the tool validated. */
function asInput(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** The stored reach, narrowed once; anything else reads as none. */
function asReach(raw: string | null | undefined): BotApprovalReach | null {
  return BOT_APPROVAL_REACHES.includes(raw as BotApprovalReach) ? (raw as BotApprovalReach) : null;
}

/** The stored scopes, narrowed once; an unknown one is dropped, never widened to all. */
function asScopes(raw: unknown): Scope[] | null {
  if (raw === null || raw === undefined) return null;
  return Array.isArray(raw)
    ? raw.filter((scope): scope is Scope => SCOPES.includes(scope as Scope))
    : [];
}
