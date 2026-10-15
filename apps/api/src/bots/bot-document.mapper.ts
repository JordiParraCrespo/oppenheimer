import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import type { BotAuthor, BotDocumentName } from '@oppenheimer/shared';
import { BotDocumentOrmEntity } from './database/bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from './database/bot-document-revision.orm-entity';
import type { BotDocumentRevision } from './domain/bot.types';
import { BotDocumentEntity } from './domain/bot-document.entity';
import { BotDocumentResponseDto } from './dtos/bot-document.response.dto';
import { BotDocumentRevisionResponseDto } from './dtos/bot-document-revision.response.dto';

/** A document and its revisions. The `CHECK`s on both tables hold the unions read here. */
@Injectable()
export class BotDocumentMapper
  implements Mapper<BotDocumentEntity, BotDocumentOrmEntity, BotDocumentResponseDto>
{
  toPersistence(entity: BotDocumentEntity): BotDocumentOrmEntity {
    const record = new BotDocumentOrmEntity();
    record.organizationId = entity.organizationId;
    record.botId = entity.botId;
    record.name = entity.name;
    record.content = entity.content;
    record.revision = entity.revision;
    record.updatedBy = entity.updatedBy;
    record.updatedByUserId = entity.updatedByUserId;
    return record;
  }

  toDomain(record: BotDocumentOrmEntity): BotDocumentEntity {
    return BotDocumentEntity.create({
      id: `${record.botId}:${record.name}`,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        botId: record.botId,
        name: record.name as BotDocumentName,
        content: record.content,
        revision: record.revision,
        updatedBy: record.updatedBy as BotAuthor,
        updatedByUserId: record.updatedByUserId ?? null,
      },
    });
  }

  toResponse(entity: BotDocumentEntity): BotDocumentResponseDto {
    const dto = new BotDocumentResponseDto();
    dto.name = entity.name;
    dto.content = entity.content;
    dto.revision = entity.revision;
    dto.updatedBy = entity.updatedBy;
    dto.updatedByUserId = entity.updatedByUserId;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }

  revisionToRecord(revision: BotDocumentRevision): BotDocumentRevisionOrmEntity {
    const record = new BotDocumentRevisionOrmEntity();
    record.id = revision.id;
    record.organizationId = revision.organizationId;
    record.botId = revision.botId;
    record.name = revision.name;
    record.revision = revision.revision;
    record.content = revision.content;
    record.author = revision.author;
    record.authorUserId = revision.authorUserId;
    record.note = revision.note;
    record.revertedFrom = revision.revertedFrom;
    return record;
  }

  revisionToDomain(record: BotDocumentRevisionOrmEntity): BotDocumentRevision {
    return {
      id: record.id,
      organizationId: record.organizationId,
      botId: record.botId,
      name: record.name as BotDocumentName,
      revision: record.revision,
      content: record.content,
      author: record.author as BotAuthor,
      authorUserId: record.authorUserId ?? null,
      note: record.note,
      revertedFrom: record.revertedFrom ?? null,
      createdAt: record.createdAt,
    };
  }

  revisionToResponse(revision: BotDocumentRevision): BotDocumentRevisionResponseDto {
    const dto = new BotDocumentRevisionResponseDto();
    dto.id = revision.id;
    dto.name = revision.name;
    dto.revision = revision.revision;
    dto.content = revision.content;
    dto.author = revision.author;
    dto.authorUserId = revision.authorUserId;
    dto.note = revision.note;
    dto.revertedFrom = revision.revertedFrom;
    dto.createdAt = revision.createdAt.toISOString();
    return dto;
  }
}
