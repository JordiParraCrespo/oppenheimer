import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, type SelectQueryBuilder } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import { BotResource } from '../../bots/bots.resource';
import { BotPermissionRuleMapper } from '../bot-permission-rule.mapper';
import type { BotPermissionRuleEntity } from '../domain/bot-permission-rule.entity';
import { BotPermissionRuleOrmEntity } from './bot-permission-rule.orm-entity';
import type { BotPermissionRuleRepositoryPort } from './bot-permission-rule.repository.port';

@Injectable()
export class BotPermissionRuleRepository
  extends ScopedRepositoryBase<BotPermissionRuleOrmEntity>
  implements BotPermissionRuleRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'rule';

  constructor(
    @InjectRepository(BotPermissionRuleOrmEntity)
    protected readonly repository: Repository<BotPermissionRuleOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotPermissionRuleMapper,
  ) {
    super();
  }

  findAll(scope: AccessScope, botId: string): Promise<BotPermissionRuleEntity[]> {
    return this.oldestFirst(this.scopedQuery(scope).andWhere('rule.botId = :botId', { botId }));
  }

  findAllForTurn(organizationId: string, botId: string): Promise<BotPermissionRuleEntity[]> {
    return this.oldestFirst(
      this.repository
        .createQueryBuilder('rule')
        .where('rule.organizationId = :organizationId AND rule.botId = :botId', {
          organizationId,
          botId,
        }),
    );
  }

  private async oldestFirst(
    query: SelectQueryBuilder<BotPermissionRuleOrmEntity>,
  ): Promise<BotPermissionRuleEntity[]> {
    // IDX_bot_permission_rule_bot, in order.
    const records = await query
      .orderBy('rule.createdAt', 'ASC')
      .addOrderBy('rule.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async insert(
    rule: BotPermissionRuleEntity,
    max: number,
  ): Promise<'inserted' | 'full' | 'missing'> {
    return this.dataSource.transaction(async (manager) => {
      const locked: unknown[] = await manager.query(
        `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
        [rule.organizationId, rule.botId],
      );
      if (locked.length === 0) return 'missing' as const;
      const [{ count }]: { count: number }[] = await manager.query(
        `SELECT count(*)::int AS count FROM bot_permission_rule
          WHERE "organizationId" = $1 AND "botId" = $2`,
        [rule.organizationId, rule.botId],
      );
      if (count >= max) return 'full' as const;
      await manager
        .getRepository(BotPermissionRuleOrmEntity)
        .insert(this.mapper.toPersistence(rule));
      return 'inserted' as const;
    });
  }

  async delete(scope: AccessScope, botId: string, ruleId: string): Promise<boolean> {
    const found = await this.scopedQuery(scope)
      .andWhere('rule.botId = :botId AND rule.id = :ruleId', { botId, ruleId })
      .getOne();
    if (!found) return false;
    await this.repository.delete({ id: found.id, organizationId: found.organizationId });
    return true;
  }
}
