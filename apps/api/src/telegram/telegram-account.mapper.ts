import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { TelegramStateMessage } from '@oppenheimer/shared/protocol';
import { TelegramAccountOrmEntity } from './database/telegram-account.orm-entity';
import { TelegramAccountEntity, type TelegramBotReport } from './domain/telegram-account.entity';
import { TelegramAccountResponseDto } from './dtos/telegram-account.response.dto';
import type { TelegramAccountView } from './queries/find-telegram-accounts/find-telegram-accounts.query';

@Injectable()
export class TelegramAccountMapper
  implements Mapper<TelegramAccountEntity, TelegramAccountOrmEntity, TelegramAccountResponseDto>
{
  toPersistence(entity: TelegramAccountEntity): TelegramAccountOrmEntity {
    const record = new TelegramAccountOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.hostId = entity.hostId;
    record.label = entity.label;
    record.status = entity.status;
    record.botId = entity.botId;
    record.username = entity.username;
    record.displayName = entity.displayName;
    record.statusReason = entity.statusReason;
    record.answeringBotId = entity.answeringBotId;
    record.ownerTelegramId = entity.ownerTelegramId;
    record.ownerLinkCodeHash = entity.ownerLinkCodeHash;
    record.ownerLinkExpiresAt = entity.ownerLinkExpiresAt;
    return record;
  }

  toDomain(record: TelegramAccountOrmEntity): TelegramAccountEntity {
    return TelegramAccountEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        hostId: record.hostId,
        label: record.label,
        status: record.status,
        botId: record.botId,
        username: record.username,
        displayName: record.displayName,
        statusReason: record.statusReason,
        answeringBotId: record.answeringBotId,
        ownerTelegramId: record.ownerTelegramId,
        ownerLinkCodeHash: record.ownerLinkCodeHash,
        ownerLinkExpiresAt: record.ownerLinkExpiresAt,
      },
    });
  }

  /** `hostOnline` is the link's, read now. */
  toResponse(entity: TelegramAccountEntity, hostOnline = false): TelegramAccountResponseDto {
    const dto = new TelegramAccountResponseDto();
    dto.id = entity.id;
    dto.hostId = entity.hostId;
    dto.label = entity.label;
    dto.status = entity.status;
    dto.hostOnline = hostOnline;
    dto.botId = entity.botId;
    dto.username = entity.username;
    dto.displayName = entity.displayName;
    dto.statusReason = entity.statusReason;
    dto.answeringBotId = entity.answeringBotId;
    dto.ownerLinked = entity.ownerTelegramId !== null;
    dto.linkedAt = entity.createdAt.toISOString();
    return dto;
  }

  /** A Telegram bot as its reads answer it: with whether its host can be reached now. */
  toView(account: TelegramAccountEntity, hostOnline: boolean): TelegramAccountView {
    return { account, hostOnline };
  }

  /** The host's `telegram.state`, as the aggregate takes it. */
  toReport(message: TelegramStateMessage): TelegramBotReport {
    return {
      state: message.state,
      ...(message.botId ? { botId: message.botId } : {}),
      ...(message.username ? { username: message.username } : {}),
      ...(message.name ? { name: message.name } : {}),
      ...(message.reason ? { reason: message.reason } : {}),
    };
  }
}
