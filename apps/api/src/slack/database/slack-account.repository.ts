import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { type DomainEvent, OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { SlackAccountEntity } from '../domain/slack-account.entity';
import { SlackResource } from '../slack.resource';
import { SlackAccountMapper } from '../slack-account.mapper';
import { SlackAccountOrmEntity } from './slack-account.orm-entity';
import type { SlackAccountRepositoryPort } from './slack-account.repository.port';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class SlackAccountRepository
  extends ScopedRepositoryBase<SlackAccountOrmEntity>
  implements SlackAccountRepositoryPort
{
  protected readonly resource = SlackResource;
  protected readonly alias = 'account';

  constructor(
    @InjectRepository(SlackAccountOrmEntity)
    protected readonly repository: Repository<SlackAccountOrmEntity>,
    private readonly mapper: SlackAccountMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async findAllOwn(scope: AccessScope): Promise<SlackAccountEntity[]> {
    const records = await this.ownQuery(scope)
      .orderBy('account.createdAt', 'ASC')
      .addOrderBy('account.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOwnById(scope: AccessScope, id: string): Promise<Option<SlackAccountEntity>> {
    const record = await this.ownQuery(scope).andWhere('account.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOwnByBot(scope: AccessScope, botId: string): Promise<Option<SlackAccountEntity>> {
    const record = await this.ownQuery(scope)
      .andWhere('account.botId = :botId', { botId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByBotForSystem(botId: string): Promise<Option<SlackAccountEntity>> {
    // UQ_slack_account_bot.
    const record = await this.repository.findOneBy({ botId });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findByIdForSystem(organizationId: string, id: string): Promise<Option<SlackAccountEntity>> {
    const record = await this.repository.findOneBy({ organizationId, id });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async put(account: SlackAccountEntity): Promise<'saved' | 'taken'> {
    try {
      // UQ_slack_account_bot: a bot's app is written over, never doubled.
      await this.repository.upsert(this.mapper.toPersistence(account), {
        conflictPaths: ['botId'],
        skipUpdateIfNoValuesChanged: true,
      });
      return 'saved';
    } catch (error) {
      const { code, constraint } = (error ?? {}) as { code?: string; constraint?: string };
      if (code === UNIQUE_VIOLATION && constraint === 'UQ_slack_account_app') return 'taken';
      throw error;
    }
  }

  async saveStatus(account: SlackAccountEntity): Promise<void> {
    await this.repository.update(
      { id: account.id, organizationId: account.organizationId },
      { status: account.status, statusReason: account.statusReason },
    );
  }

  async saveOwnerLink(account: SlackAccountEntity): Promise<void> {
    await this.repository.update(
      { id: account.id, organizationId: account.organizationId, userId: account.userId },
      {
        ownerLinkCodeHash: account.ownerLinkCodeHash,
        ownerLinkExpiresAt: account.ownerLinkExpiresAt,
      },
    );
  }

  async saveOwner(account: SlackAccountEntity, usedCodeHash: string): Promise<boolean> {
    // PK, conditional on the code it used.
    const result = await this.repository.update(
      { id: account.id, organizationId: account.organizationId, ownerLinkCodeHash: usedCodeHash },
      {
        ownerSlackUserId: account.ownerSlackUserId,
        ownerLinkCodeHash: null,
        ownerLinkExpiresAt: null,
      },
    );
    return result.affected === 1;
  }

  async publish(events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.outbox.transaction((manager) => this.outbox.stageEvents(manager, [...events]));
  }

  async delete(account: SlackAccountEntity): Promise<void> {
    await this.repository.delete({
      id: account.id,
      organizationId: account.organizationId,
      userId: account.userId,
    });
  }

  /**
   * The workspace clause is the scope's; the owner is this repository's, so
   * even a caller who can read every row of the workspace reads only their own.
   */
  private ownQuery(scope: AccessScope) {
    return this.scopedQuery(scope).andWhere('account.userId = :userId', {
      userId: scope.userId,
    });
  }
}
