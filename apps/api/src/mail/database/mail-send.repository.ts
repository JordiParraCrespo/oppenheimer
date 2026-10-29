import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { LessThanOrEqual, Repository } from 'typeorm';
import type { MailSendEntity } from '../domain/mail-send.entity';
import { MailResource } from '../mail.resource';
import { MailSendMapper } from '../mail-send.mapper';
import { MailSendOrmEntity } from './mail-send.orm-entity';
import type { MailSendRepositoryPort } from './mail-send.repository.port';

@Injectable()
export class MailSendRepository
  extends ScopedRepositoryBase<MailSendOrmEntity>
  implements MailSendRepositoryPort
{
  protected readonly resource = MailResource;
  protected readonly alias = 'send';

  constructor(
    @InjectRepository(MailSendOrmEntity)
    protected readonly repository: Repository<MailSendOrmEntity>,
    private readonly mapper: MailSendMapper,
  ) {
    super();
  }

  async findByApproval(approvalId: string): Promise<Option<MailSendEntity>> {
    const record = await this.repository.findOne({ where: { approvalId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async claim(send: MailSendEntity): Promise<boolean> {
    // `ON CONFLICT DO NOTHING ... RETURNING id`: a row back means this claim won.
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .values(this.mapper.toPersistence(send))
      .orIgnore()
      .returning(['id'])
      .execute();
    return Array.isArray(result.raw) && result.raw.length === 1;
  }

  async save(send: MailSendEntity): Promise<void> {
    const { id, organizationId, ...changes } = this.mapper.toPersistence(send);
    await this.repository.update({ id, organizationId }, changes);
  }

  async countSince(connectionId: string, since: Date): Promise<number> {
    // By when each went: a sent one by its `sentAt`, one still going by its claim
    // (`updatedAt`), so a send scheduled days ago counts on the day it goes.
    return this.repository
      .createQueryBuilder('send')
      .where('send.connectionId = :connectionId', { connectionId })
      .andWhere(
        `((send.status = 'sent' AND send.sentAt > :since) OR (send.status = 'sending' AND send.updatedAt > :since))`,
        { since },
      )
      .getCount();
  }

  async findDue(now: Date, limit: number): Promise<MailSendEntity[]> {
    const records = await this.repository.find({
      where: { status: 'scheduled', scheduledFor: LessThanOrEqual(now) },
      order: { scheduledFor: 'ASC', id: 'ASC' },
      take: limit,
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  async claimDue(send: MailSendEntity): Promise<boolean> {
    const result = await this.repository.update(
      { id: send.id, status: 'scheduled' },
      { status: 'sending' },
    );
    return result.affected === 1;
  }

  async cancelOwn(scope: AccessScope, id: string): Promise<boolean> {
    if (!scope.organizationId) return false;
    const result = await this.repository.update(
      {
        id,
        organizationId: scope.organizationId,
        userId: scope.userId,
        status: 'scheduled',
      },
      { status: 'cancelled', plan: null },
    );
    return result.affected === 1;
  }

  async findScheduledOwn(scope: AccessScope, limit: number): Promise<MailSendEntity[]> {
    const records = await this.scopedQuery(scope)
      .andWhere('send.userId = :userId', { userId: scope.userId })
      .andWhere(`send.status = 'scheduled'`)
      .orderBy('send.scheduledFor', 'ASC')
      .addOrderBy('send.id', 'ASC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findRecentOwn(scope: AccessScope, limit: number): Promise<MailSendEntity[]> {
    const records = await this.scopedQuery(scope)
      .andWhere('send.userId = :userId', { userId: scope.userId })
      .orderBy('send.createdAt', 'DESC')
      .addOrderBy('send.id', 'DESC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }
}
