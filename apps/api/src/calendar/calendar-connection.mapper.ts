import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { CalendarConnectionOrmEntity } from './database/calendar-connection.orm-entity';
import { CalendarConnectionEntity } from './domain/calendar-connection.entity';
import { GoogleCalendarConnectionResponseDto } from './dtos/google-calendar-connection.response.dto';

@Injectable()
export class CalendarConnectionMapper
  implements
    Mapper<
      CalendarConnectionEntity,
      CalendarConnectionOrmEntity,
      GoogleCalendarConnectionResponseDto
    >
{
  toPersistence(entity: CalendarConnectionEntity): CalendarConnectionOrmEntity {
    const record = new CalendarConnectionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.provider = entity.provider;
    record.accountEmail = entity.accountEmail;
    record.accountSubject = entity.accountSubject;
    record.colorIndex = entity.colorIndex;
    record.refreshTokenSealed = entity.refreshTokenSealed;
    record.scopes = entity.scopes;
    record.status = entity.status;
    return record;
  }

  toDomain(record: CalendarConnectionOrmEntity): CalendarConnectionEntity {
    return CalendarConnectionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        provider: record.provider,
        accountEmail: record.accountEmail,
        accountSubject: record.accountSubject ?? null,
        colorIndex: record.colorIndex ?? 0,
        refreshTokenSealed: record.refreshTokenSealed,
        scopes: record.scopes ?? [],
        status: record.status,
      },
    });
  }

  /** Never the token: the account, its state and its colour. */
  toResponse(entity: CalendarConnectionEntity): GoogleCalendarConnectionResponseDto {
    const dto = new GoogleCalendarConnectionResponseDto();
    dto.id = entity.id;
    dto.accountEmail = entity.accountEmail;
    dto.status = entity.status;
    dto.colorIndex = entity.colorIndex;
    dto.connectedAt = entity.createdAt.toISOString();
    return dto;
  }
}
