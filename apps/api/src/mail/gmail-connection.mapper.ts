import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { GmailConnectionOrmEntity } from './database/gmail-connection.orm-entity';
import { GmailConnectionEntity } from './domain/gmail-connection.entity';
import { GmailConnectionResponseDto } from './dtos/gmail-connection.response.dto';

@Injectable()
export class GmailConnectionMapper
  implements Mapper<GmailConnectionEntity, GmailConnectionOrmEntity, GmailConnectionResponseDto>
{
  toPersistence(entity: GmailConnectionEntity): GmailConnectionOrmEntity {
    const record = new GmailConnectionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.googleSubject = entity.googleSubject;
    record.accountEmail = entity.accountEmail;
    record.label = entity.label;
    record.refreshTokenSealed = entity.refreshTokenSealed;
    record.scopes = entity.scopes;
    record.status = entity.status;
    return record;
  }

  toDomain(record: GmailConnectionOrmEntity): GmailConnectionEntity {
    return GmailConnectionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        googleSubject: record.googleSubject,
        accountEmail: record.accountEmail,
        label: record.label,
        refreshTokenSealed: record.refreshTokenSealed,
        scopes: record.scopes ?? [],
        status: record.status,
      },
    });
  }

  /** Never the token: the account, its name and its state. */
  toResponse(entity: GmailConnectionEntity): GmailConnectionResponseDto {
    const dto = new GmailConnectionResponseDto();
    dto.id = entity.id;
    dto.accountEmail = entity.accountEmail;
    dto.label = entity.label;
    dto.status = entity.status;
    dto.connectedAt = entity.createdAt.toISOString();
    return dto;
  }
}
