import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { InboxReportStatus } from '@oppenheimer/shared';
import { InboxReportOrmEntity } from './database/inbox-report.orm-entity';
import { InboxReportEntity } from './domain/inbox-report.entity';
import { InboxReportResponseDto } from './dtos/inbox-report.response.dto';

@Injectable()
export class InboxReportMapper
  implements Mapper<InboxReportEntity, InboxReportOrmEntity, InboxReportResponseDto>
{
  toPersistence(entity: InboxReportEntity): InboxReportOrmEntity {
    const record = new InboxReportOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.createdByUserId = entity.createdByUserId;
    record.title = entity.title;
    record.body = entity.body;
    record.source = entity.source;
    record.link = entity.link;
    record.images = entity.images.map((image) => ({ ...image }));
    record.status = entity.status;
    record.answer = entity.answer;
    record.answeredByUserId = entity.answeredByUserId;
    record.answeredAt = entity.answeredAt;
    return record;
  }

  toDomain(record: InboxReportOrmEntity): InboxReportEntity {
    return InboxReportEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        createdByUserId: record.createdByUserId,
        title: record.title,
        body: record.body,
        source: record.source,
        link: record.link,
        images: record.images.map((image) => ({ ...image })),
        status: record.status as InboxReportStatus,
        answer: record.answer,
        answeredByUserId: record.answeredByUserId,
        answeredAt: record.answeredAt,
      },
    });
  }

  /** The stored key stays here: a picture is read by its id, through the API. */
  toResponse(entity: InboxReportEntity): InboxReportResponseDto {
    const dto = new InboxReportResponseDto();
    dto.id = entity.id;
    dto.title = entity.title;
    dto.body = entity.body;
    dto.source = entity.source;
    dto.link = entity.link;
    dto.images = entity.images.map(({ id, mimeType, sizeBytes, name }) => ({
      id,
      mimeType,
      sizeBytes,
      name,
    }));
    dto.status = entity.status;
    dto.answer = entity.answer;
    dto.answeredAt = entity.answeredAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}
