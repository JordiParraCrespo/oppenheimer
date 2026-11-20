import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { SlackAccountOrmEntity } from './database/slack-account.orm-entity';
import { SlackAccountEntity } from './domain/slack-account.entity';
import { SlackAccountResponseDto } from './dtos/slack-account.response.dto';

@Injectable()
export class SlackAccountMapper
  implements Mapper<SlackAccountEntity, SlackAccountOrmEntity, SlackAccountResponseDto>
{
  toPersistence(entity: SlackAccountEntity): SlackAccountOrmEntity {
    const record = new SlackAccountOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.botId = entity.botId;
    record.status = entity.status;
    record.statusReason = entity.statusReason;
    record.teamId = entity.teamId;
    record.teamName = entity.teamName;
    record.botUserId = entity.botUserId;
    record.botName = entity.botName;
    record.sealedBotToken = entity.sealedBotToken;
    record.sealedSigningSecret = entity.sealedSigningSecret;
    record.tokenHint = entity.tokenHint;
    record.ownerSlackUserId = entity.ownerSlackUserId;
    record.ownerLinkCodeHash = entity.ownerLinkCodeHash;
    record.ownerLinkExpiresAt = entity.ownerLinkExpiresAt;
    return record;
  }

  toDomain(record: SlackAccountOrmEntity): SlackAccountEntity {
    return SlackAccountEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        botId: record.botId,
        status: record.status,
        statusReason: record.statusReason,
        teamId: record.teamId,
        teamName: record.teamName,
        botUserId: record.botUserId,
        botName: record.botName,
        sealedBotToken: record.sealedBotToken,
        sealedSigningSecret: record.sealedSigningSecret,
        tokenHint: record.tokenHint,
        ownerSlackUserId: record.ownerSlackUserId,
        ownerLinkCodeHash: record.ownerLinkCodeHash,
        ownerLinkExpiresAt: record.ownerLinkExpiresAt,
      },
    });
  }

  /** Never the token or the secret. */
  toResponse(entity: SlackAccountEntity): SlackAccountResponseDto {
    const dto = new SlackAccountResponseDto();
    dto.id = entity.id;
    dto.botId = entity.botId;
    dto.status = entity.status;
    dto.statusReason = entity.statusReason;
    dto.teamId = entity.teamId;
    dto.teamName = entity.teamName;
    dto.botUserId = entity.botUserId;
    dto.botName = entity.botName;
    dto.tokenHint = entity.tokenHint;
    dto.ownerLinked = entity.ownerSlackUserId !== null;
    dto.linkedAt = entity.createdAt.toISOString();
    return dto;
  }
}
