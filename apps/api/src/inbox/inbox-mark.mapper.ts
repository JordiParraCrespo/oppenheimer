import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { InboxMark } from '@oppenheimer/shared';
import { InboxMarkOrmEntity } from './database/inbox-mark.orm-entity';
import { InboxMarkEntity } from './domain/inbox-mark.entity';
import { InboxMarkResponseDto } from './dtos/inbox-mark.response.dto';

@Injectable()
export class InboxMarkMapper
  implements Mapper<InboxMarkEntity, InboxMarkOrmEntity, InboxMarkResponseDto>
{
  toPersistence(entity: InboxMarkEntity): InboxMarkOrmEntity {
    const record = new InboxMarkOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.itemKey = entity.itemKey;
    record.mark = entity.mark;
    record.until = entity.until;
    return record;
  }

  toDomain(record: InboxMarkOrmEntity): InboxMarkEntity {
    return InboxMarkEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        itemKey: record.itemKey,
        mark: record.mark as InboxMark,
        until: record.until,
      },
    });
  }

  toResponse(entity: InboxMarkEntity): InboxMarkResponseDto {
    const dto = new InboxMarkResponseDto();
    dto.itemKey = entity.itemKey;
    dto.mark = entity.mark;
    dto.until = entity.until?.toISOString() ?? null;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
