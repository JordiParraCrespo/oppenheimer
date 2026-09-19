import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository, type SelectQueryBuilder } from 'typeorm';
import type { HostEntity } from '../domain/host.entity';
import { HostMapper } from '../host.mapper';
import { HostResource } from '../hosts.resource';
import { HostOrmEntity } from './host.orm-entity';
import {
  HOST_ONLINE_WINDOW_SECONDS,
  type HostPresence,
  type HostRepositoryPort,
  type RedeemAndRegisterInput,
} from './host.repository.port';

/** The presence flag, computed by the database beside the row it describes. */
const ONLINE_EXPRESSION = `host."lastSeenAt" > now() - (:onlineWindowSeconds * interval '1 second')`;

/**
 * TypeORM adapter for the host aggregate.
 *
 * Note what is absent from the reads: no owner test and no tenant filter.
 * Extending `ScopedRepositoryBase` and naming `HostResource` is the whole of it —
 * and because that resource declares no organization key, the generated
 * predicate is `own OR granted` with no tenant clause in front of it, which is
 * exactly what a person-owned row wants.
 */
@Injectable()
export class HostRepository
  extends ScopedRepositoryBase<HostOrmEntity>
  implements HostRepositoryPort
{
  protected readonly resource = HostResource;
  protected readonly alias = 'host';

  constructor(
    @InjectRepository(HostOrmEntity)
    protected readonly repository: Repository<HostOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: HostMapper,
    private readonly outbox: OutboxService,
  ) {
    super();
  }

  async findAllWithPresence(scope: AccessScope): Promise<HostPresence[]> {
    const query = this.withPresence(this.scopedQuery(scope)).orderBy('host.createdAt', 'DESC');
    const { entities, raw } = await query.getRawAndEntities();
    return entities.map((record, index) => ({
      host: this.mapper.toDomain(record),
      online: isOnline(raw[index]),
    }));
  }

  async findOneByIdWithPresence(scope: AccessScope, id: string): Promise<Option<HostPresence>> {
    const query = this.withPresence(this.scopedQuery(scope)).andWhere('host.id = :id', { id });
    const { entities, raw } = await query.getRawAndEntities();
    const record = entities[0];
    if (!record) return None;
    return Some({ host: this.mapper.toDomain(record), online: isOnline(raw[0]) });
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<HostEntity>> {
    const record = await this.scopedQuery(scope).andWhere('host.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByIdForMachine(id: string): Promise<Option<HostEntity>> {
    const record = await this.unscopedQuery(
      'a host proves its own identity with a signature or the secret it paired with; there is no person on the request to scope by',
    )
      .where('host.id = :id', { id })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async save(entity: HostEntity): Promise<HostEntity> {
    const record = await this.outbox.writeWithEvents([entity], (manager) =>
      manager.getRepository(HostOrmEntity).save(this.mapper.toPersistence(entity)),
    );
    return this.mapper.toDomain(record);
  }

  /**
   * The burn and the insert, in one transaction.
   *
   * The `UPDATE … WHERE tokenHash = $1 AND redeemedAt IS NULL AND revokedAt IS
   * NULL AND expiresAt > now() RETURNING` is what makes a token single-use: the
   * database decides the race, so two machines presenting one secret produce one
   * host. `revokedAt IS NULL` is load-bearing — without it `DELETE
   * /hosts/pairing/{id}` would write a column nobody reads and a revoked token
   * would still pair a machine.
   *
   * `redeemedHostId` is written by the same statement, so a lost response is not
   * a lost host: the retry finds the token spent, matches the fingerprint it
   * presents, and is handed the host that already exists.
   *
   * The transaction is opened here rather than through
   * `OutboxService.writeWithEvents`, which skips the explicit transaction when an
   * aggregate happens to carry no events. That is the right default for a single
   * statement and the wrong one for these two, whose whole point is committing
   * together — so the events are staged inside the transaction this method owns.
   */
  async redeemAndRegister(input: RedeemAndRegisterInput): Promise<Option<HostEntity>> {
    const record = this.mapper.toPersistence(input.host);

    const registered = await this.dataSource.transaction(async (manager) => {
      // TypeORM answers an `UPDATE … RETURNING` with `[rows, affectedCount]`,
      // not with the rows alone — reading it as an array of rows would make
      // every redemption look successful.
      const [burned] = (await manager.query(
        `UPDATE "host_pairing_token"
            SET "redeemedAt" = $2, "redeemedHostId" = $3, "redeemedFromIp" = $4, "updatedAt" = $2
          WHERE "tokenHash" = $1
            AND "redeemedAt" IS NULL
            AND "revokedAt" IS NULL
            AND "expiresAt" > $2
        RETURNING "id"`,
        [input.tokenHash, input.now, record.id, input.redeemedFromIp],
      )) as [{ id: string }[], number];

      if (burned.length === 0) return false;

      const hosts = manager.getRepository(HostOrmEntity);
      // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
      // represent the free-form `capabilities` jsonb.
      await hosts.insert(record as Parameters<typeof hosts.insert>[0]);
      await this.outbox.stageEvents(manager, input.host.domainEvents);
      return true;
    });

    if (!registered) return None;

    input.host.clearEvents();
    await this.outbox.wake();
    return Some(input.host);
  }

  /** Adds the presence flag to a query without disturbing its entity mapping. */
  private withPresence(
    query: SelectQueryBuilder<HostOrmEntity>,
  ): SelectQueryBuilder<HostOrmEntity> {
    return query
      .addSelect(ONLINE_EXPRESSION, 'online')
      .setParameter('onlineWindowSeconds', HOST_ONLINE_WINDOW_SECONDS);
  }
}

/**
 * Reads the computed flag out of the raw row. A host that has never sent a
 * heartbeat compares to `null`, which is neither true nor false in SQL, so
 * anything other than an explicit `true` is offline.
 */
function isOnline(raw: unknown): boolean {
  return (raw as { online?: unknown } | undefined)?.online === true;
}
