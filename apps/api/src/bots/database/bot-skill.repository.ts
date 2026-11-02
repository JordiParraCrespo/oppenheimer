import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository } from 'typeorm';
import { BotSkillMapper } from '../bot-skill.mapper';
import { BotResource } from '../bots.resource';
import type { BotSkillEntity } from '../domain/bot-skill.entity';
import { violated } from './bot.repository';
import { BotSkillOrmEntity } from './bot-skill.orm-entity';
import type { BotSkillRepositoryPort } from './bot-skill.repository.port';

const UNIQUE_VIOLATION = '23505';
const NAME_CONSTRAINT = 'UQ_bot_skill_name';

/** A bot's skills, every read through `UQ_bot_skill_name`. */
@Injectable()
export class BotSkillRepository
  extends ScopedRepositoryBase<BotSkillOrmEntity>
  implements BotSkillRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'skill';

  constructor(
    @InjectRepository(BotSkillOrmEntity)
    protected readonly repository: Repository<BotSkillOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotSkillMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope, botId: string): Promise<BotSkillEntity[]> {
    const records = await this.scopedQuery(scope)
      .andWhere('skill.botId = :botId', { botId })
      .orderBy('skill.name', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findAllForTurn(organizationId: string, botId: string): Promise<BotSkillEntity[]> {
    const records = await this.repository.find({
      where: { organizationId, botId },
      order: { name: 'ASC' },
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(
    scope: AccessScope,
    botId: string,
    skillId: string,
  ): Promise<Option<BotSkillEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('skill.botId = :botId AND skill.id = :skillId', { botId, skillId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByName(
    scope: AccessScope,
    botId: string,
    name: string,
  ): Promise<Option<BotSkillEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('skill.botId = :botId AND skill.name = :name', { botId, name })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(
    skill: BotSkillEntity,
    max: number,
  ): Promise<'inserted' | 'full' | 'taken' | 'missing'> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const locked: unknown[] = await manager.query(
          `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
          [skill.organizationId, skill.botId],
        );
        if (locked.length === 0) return 'missing' as const;
        const [{ count }]: { count: number }[] = await manager.query(
          `SELECT count(*)::int AS count FROM bot_skill
            WHERE "organizationId" = $1 AND "botId" = $2`,
          [skill.organizationId, skill.botId],
        );
        if (count >= max) return 'full' as const;
        await manager.getRepository(BotSkillOrmEntity).insert(this.mapper.toPersistence(skill));
        return 'inserted' as const;
      });
    } catch (error) {
      if (violated(error, UNIQUE_VIOLATION, NAME_CONSTRAINT)) return 'taken';
      throw error;
    }
  }

  async save(skill: BotSkillEntity): Promise<'saved' | 'taken' | 'missing'> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(BotSkillOrmEntity)
        .set({
          name: skill.name,
          description: skill.description,
          body: skill.body,
          userInvocable: skill.userInvocable,
          modelInvocable: skill.modelInvocable,
          source: skill.source,
        })
        .where('id = :id AND "organizationId" = :organizationId AND "botId" = :botId', {
          id: skill.id,
          organizationId: skill.organizationId,
          botId: skill.botId,
        })
        .execute();
      return result.affected === 1 ? 'saved' : 'missing';
    } catch (error) {
      if (violated(error, UNIQUE_VIOLATION, NAME_CONSTRAINT)) return 'taken';
      throw error;
    }
  }

  async delete(skill: BotSkillEntity): Promise<void> {
    await this.repository.delete({
      id: skill.id,
      organizationId: skill.organizationId,
      botId: skill.botId,
    });
  }
}
