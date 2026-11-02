import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { DataSource, type EntityManager, Repository, type SelectQueryBuilder } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotToolPermissionMapper } from '../bot-tool-permission.mapper';
import type { BotToolPermissionEntity } from '../domain/bot-tool-permission.entity';
import { BotToolPermissionOrmEntity } from './bot-tool-permission.orm-entity';
import type { BotToolPermissionRepositoryPort } from './bot-tool-permission.repository.port';

@Injectable()
export class BotToolPermissionRepository
  extends ScopedRepositoryBase<BotToolPermissionOrmEntity>
  implements BotToolPermissionRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'permission';

  constructor(
    @InjectRepository(BotToolPermissionOrmEntity)
    protected readonly repository: Repository<BotToolPermissionOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotToolPermissionMapper,
  ) {
    super();
  }

  findAll(scope: AccessScope, botId: string): Promise<BotToolPermissionEntity[]> {
    return this.newestFirst(
      this.scopedQuery(scope).andWhere('permission.botId = :botId', { botId }),
    );
  }

  findAllForTurn(organizationId: string, botId: string): Promise<BotToolPermissionEntity[]> {
    return this.newestFirst(
      this.repository
        .createQueryBuilder('permission')
        .where('permission.organizationId = :organizationId AND permission.botId = :botId', {
          organizationId,
          botId,
        }),
    );
  }

  private async newestFirst(
    query: SelectQueryBuilder<BotToolPermissionOrmEntity>,
  ): Promise<BotToolPermissionEntity[]> {
    // IDX_bot_tool_permission_bot: a bot holds a row per tool set and its
    // grants (BOT_TOOL_GRANTS_MAX), so the sort is over a handful of rows.
    const records = await query
      .orderBy('permission.createdAt', 'DESC')
      .addOrderBy('permission.id', 'DESC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async setDecision(permission: BotToolPermissionEntity): Promise<'saved' | 'missing'> {
    return upsertDecisionWithin(this.dataSource.manager, this.mapper.toPersistence(permission));
  }

  async clearDecision(organizationId: string, botId: string, tool: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .delete()
      .from(BotToolPermissionOrmEntity)
      .where(
        '"organizationId" = :organizationId AND "botId" = :botId AND "tool" = :tool AND "subjectKind" IS NULL',
        { organizationId, botId, tool },
      )
      .execute();
  }

  insertGrant(
    grant: BotToolPermissionEntity,
    max: number,
  ): Promise<'inserted' | 'exists' | 'full' | 'missing'> {
    return this.dataSource.transaction((manager) =>
      insertGrantWithin(manager, this.mapper.toPersistence(grant), max),
    );
  }

  async deleteGrant(scope: AccessScope, botId: string, grantId: string): Promise<boolean> {
    const found = await this.scopedQuery(scope)
      .andWhere('permission.botId = :botId AND permission.id = :grantId', { botId, grantId })
      .andWhere('permission.subjectKind IS NOT NULL')
      .getOne();
    if (!found) return false;
    await this.repository.delete({ id: found.id, organizationId: found.organizationId });
    return true;
  }
}

/**
 * A tool's own decision, replacing the one it had, in one statement: written
 * only while the bot exists, and over the tool's own row
 * (`UQ_bot_tool_permission`, `NULLS NOT DISTINCT`) when it has one. An INSERT
 * comes back as its rows: none means the bot is gone. Shared with the
 * approval that sets it ("Always allow").
 */
export async function upsertDecisionWithin(
  manager: EntityManager,
  record: BotToolPermissionOrmEntity,
): Promise<'saved' | 'missing'> {
  const rows: { id: string }[] = await manager.query(
    `INSERT INTO bot_tool_permission
       (id, "organizationId", "botId", "tool", "decision", "createdByUserId")
     SELECT $1, $2, $3, $4, $5, $6
      WHERE EXISTS (SELECT 1 FROM bot WHERE "organizationId" = $2 AND id = $3)
     ON CONFLICT ("botId", "tool", "subjectKind", "subjectKey")
     DO UPDATE SET "decision" = EXCLUDED."decision",
                   "createdByUserId" = EXCLUDED."createdByUserId",
                   "updatedAt" = now()
     RETURNING id`,
    [
      record.id,
      record.organizationId,
      record.botId,
      record.tool,
      record.decision,
      record.createdByUserId,
    ],
  );
  return rows.length > 0 ? 'saved' : 'missing';
}

/**
 * A standing grant, unless the bot already holds `max`: counted under a lock
 * on the bot row, so two racing grants cannot both take the last place. Run
 * inside the caller's transaction; shared with the approval that gives it
 * ("Always allow for …").
 */
export async function insertGrantWithin(
  manager: EntityManager,
  record: BotToolPermissionOrmEntity,
  max: number,
): Promise<'inserted' | 'exists' | 'full' | 'missing'> {
  const locked: unknown[] = await manager.query(
    `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
    [record.organizationId, record.botId],
  );
  if (locked.length === 0) return 'missing';
  const [{ count }]: { count: number }[] = await manager.query(
    `SELECT count(*)::int AS count FROM bot_tool_permission
      WHERE "organizationId" = $1 AND "botId" = $2 AND "subjectKind" IS NOT NULL`,
    [record.organizationId, record.botId],
  );
  if (count >= max) return 'full';
  const rows: { id: string }[] = await manager.query(
    `INSERT INTO bot_tool_permission
       (id, "organizationId", "botId", "tool", "decision",
        "subjectKind", "subjectKey", "subjectLabel", "createdByUserId")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT ("botId", "tool", "subjectKind", "subjectKey") DO NOTHING
     RETURNING id`,
    [
      record.id,
      record.organizationId,
      record.botId,
      record.tool,
      record.decision,
      record.subjectKind,
      record.subjectKey,
      record.subjectLabel,
      record.createdByUserId,
    ],
  );
  return rows.length > 0 ? 'inserted' : 'exists';
}
