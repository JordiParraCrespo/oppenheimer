import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AccessScope,
  applyAccessScope,
  ScopedRepositoryBase,
} from '@oppenheimer/backend-authz';
import type { BotDocumentName } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository } from 'typeorm';
import { BotDocumentMapper } from '../bot-document.mapper';
import { BotResource } from '../bots.resource';
import type { BotDocumentRevision } from '../domain/bot.types';
import type { BotDocumentEntity } from '../domain/bot-document.entity';
import { violated } from './bot.repository';
import { BotDocumentOrmEntity } from './bot-document.orm-entity';
import type {
  BotDocumentRepositoryPort,
  BotDocumentWriteOutcome,
} from './bot-document.repository.port';
import { BotDocumentRevisionOrmEntity } from './bot-document-revision.orm-entity';

const UNIQUE_VIOLATION = '23505';
const INT4_MAX = 2_147_483_647;

/** The row no longer holds the revision the writer read; thrown to roll the write back. */
class RevisionConflict extends Error {}

@Injectable()
export class BotDocumentRepository
  extends ScopedRepositoryBase<BotDocumentOrmEntity>
  implements BotDocumentRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'document';

  constructor(
    @InjectRepository(BotDocumentOrmEntity)
    protected readonly repository: Repository<BotDocumentOrmEntity>,
    @InjectRepository(BotDocumentRevisionOrmEntity)
    private readonly revisions: Repository<BotDocumentRevisionOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotDocumentMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope, botId: string): Promise<BotDocumentEntity[]> {
    // PK_bot_document. `soul` sorts after `instructions`, so the order is spelled out.
    const records = await this.scopedQuery(scope)
      .andWhere('document.botId = :botId', { botId })
      .orderBy(`CASE document.name WHEN 'soul' THEN 0 ELSE 1 END`)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOne(
    scope: AccessScope,
    botId: string,
    name: BotDocumentName,
  ): Promise<Option<BotDocumentEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('document.botId = :botId AND document.name = :name', { botId, name })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async save(document: BotDocumentEntity): Promise<BotDocumentWriteOutcome> {
    const revision = document.pendingRevision;
    if (!revision) return 'saved';
    try {
      await this.dataSource.transaction(async (manager) => {
        const result = await manager
          .createQueryBuilder()
          .update(BotDocumentOrmEntity)
          .set({
            content: document.content,
            revision: document.revision,
            updatedBy: document.updatedBy,
            updatedByUserId: document.updatedByUserId,
          })
          .where('"organizationId" = :organizationId AND "botId" = :botId AND name = :name', {
            organizationId: document.organizationId,
            botId: document.botId,
            name: document.name,
          })
          .andWhere('revision = :expected', { expected: document.expectedRevision })
          .execute();
        if (result.affected !== 1) throw new RevisionConflict();
        await manager
          .getRepository(BotDocumentRevisionOrmEntity)
          .insert(this.mapper.revisionToRecord(revision));
      });
    } catch (error) {
      // A second writer that read the same revision loses on the conditional
      // update; one that slipped past it would lose on UQ_bot_document_revision.
      if (
        error instanceof RevisionConflict ||
        violated(error, UNIQUE_VIOLATION, 'UQ_bot_document_revision')
      ) {
        return 'conflict';
      }
      throw error;
    }
    document.written();
    return 'saved';
  }

  async findRevisions(
    scope: AccessScope,
    botId: string,
    name: BotDocumentName,
    limit: number,
  ): Promise<BotDocumentRevision[]> {
    // UQ_bot_document_revision, scanned backwards.
    const records = await this.revisionQuery(scope, botId, name)
      .orderBy('revision.revision', 'DESC')
      .limit(limit)
      .getMany();
    return records.map((record) => this.mapper.revisionToDomain(record));
  }

  async findRevision(
    scope: AccessScope,
    botId: string,
    name: BotDocumentName,
    revision: number,
  ): Promise<Option<BotDocumentRevision>> {
    // A number the column cannot hold names no revision, rather than a driver error.
    if (!Number.isInteger(revision) || revision < 1 || revision > INT4_MAX) return None;
    const record = await this.revisionQuery(scope, botId, name)
      .andWhere('revision.revision = :revision', { revision })
      .getOne();
    return record ? Some(this.mapper.revisionToDomain(record)) : None;
  }

  /** Revisions carry the workspace too, so they are scoped by the same predicate. */
  private revisionQuery(scope: AccessScope, botId: string, name: BotDocumentName) {
    return applyAccessScope(
      this.revisions.createQueryBuilder('revision'),
      this.resource,
      scope,
    ).andWhere('revision.botId = :botId AND revision.name = :name', { botId, name });
  }
}
