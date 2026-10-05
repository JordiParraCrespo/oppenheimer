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
        refreshTokenSealed: record.refreshTokenSealed,
        scopes: record.scopes ?? [],
        status: record.status,
      },
    });
  }

  /** Never the token: only whether there is a connection and whose it is. */
  toResponse(entity: CalendarConnectionEntity | null): GoogleCalendarConnectionResponseDto {
    const dto = new GoogleCalendarConnectionResponseDto();
    dto.connected = entity !== null;
    dto.accountEmail = entity?.accountEmail ?? null;
    dto.status = entity?.status ?? null;
    return dto;
  }
}
