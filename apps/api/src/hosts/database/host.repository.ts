import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository } from 'typeorm';
import type { HostEntity } from '../domain/host.entity';
import { HostMapper } from '../host.mapper';
import { HostResource } from '../hosts.resource';
import { HostOrmEntity } from './host.orm-entity';
import {
  type HostPresence,
  type HostRepositoryPort,
  type RedeemAndRegisterInput,
  type RedeemedPairingToken,
} from './host.repository.port';
import { HostMetadataRepository } from './host-metadata.repository';

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
    private readonly metadata: HostMetadataRepository,
  ) {
    super();
  }

  async findAllWithPresence(
    scope: AccessScope,
    options: { includeUnpaired?: boolean } = {},
  ): Promise<HostPresence[]> {
    const query = this.scopedQuery(scope).orderBy('host.createdAt', 'DESC');
    if (!options.includeUnpaired) query.andWhere('host.unpairedAt IS NULL');
    return this.withMetadata(await query.getMany());
  }

  async findOneByIdWithPresence(scope: AccessScope, id: string): Promise<Option<HostPresence>> {
    const record = await this.scopedQuery(scope).andWhere('host.id = :id', { id }).getOne();
    if (!record) return None;
    const [presence] = await this.withMetadata([record]);
    return Some(presence);
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<HostEntity>> {
    const record = await this.scopedQuery(scope).andWhere('host.id = :id', { id }).getOne();
    if (!record) return None;
    const [presence] = await this.withMetadata([record]);
    return Some(presence.host);
  }

  async findOneByIdForMachine(id: string): Promise<Option<HostEntity>> {
    const record = await this.unscopedQuery(
      'a host proves its own identity with a signature or the secret it paired with; there is no person on the request to scope by',
    )
      .where('host.id = :id', { id })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  /**
   * The row, the outbox entries its events owe, and the timeline entries they
   * stand for, in one transaction. An unpaired host's current network stops
   * being current in the same breath, so the 90-day retention can reach it.
   */
  async save(entity: HostEntity): Promise<HostEntity> {
    const entries = this.mapper.toTimelineEntries(entity.domainEvents);
    const at = new Date();
    await this.outbox.writeWithEvents([entity], async (manager) => {
      const saved = await manager
        .getRepository(HostOrmEntity)
        .save(this.mapper.toPersistence(entity));
      await this.metadata.insertTimeline(manager, entity.id, entries, at);
      if (entries.some((entry) => entry.kind === 'unpaired')) {
        await this.metadata.clearCurrentNetwork(manager, entity.id);
      }
      return saved;
    });
    return entity;
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
    // The id is minted before the statement runs because the burn writes it into
    // `redeemedHostId` in the same breath; the row it names is inserted below,
    // which is why that foreign key is deferred to commit.
    const hostId = randomUUID();

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
        RETURNING "id", "ownerUserId", "intendedName"`,
        [input.tokenHash, input.now, hostId, input.redeemedFromIp],
      )) as [RedeemedPairingToken[], number];

      if (burned.length === 0) return null;

      const host = input.host({ ...burned[0], redeemedHostId: hostId });
      const record = this.mapper.toPersistence(host);

      const hosts = manager.getRepository(HostOrmEntity);
      // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
      // represent the free-form `capabilities` jsonb.
      await hosts.insert(record as Parameters<typeof hosts.insert>[0]);
      // The machine as it paired, and the first line of its timeline, with it.
      const inventory = this.mapper.toRegisterInventory(host);
      if (inventory) {
        await manager.query(
          `INSERT INTO "host_inventory" (
             "hostId", "factsHash", "platform", "osName", "osVersion", "kernelVersion", "arch",
             "hostname", "cpuModel", "cpuCount", "memoryTotalBytes", "diskTotalBytes",
             "virtualization", "cloudProvider", "timezone", "bootedAt", "runnerVersion",
             "serviceManager", "tools", "facts", "changedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                   $18, $19, $20, $21)`,
          [
            host.id,
            inventory.factsHash,
            inventory.platform,
            inventory.osName,
            inventory.osVersion,
            inventory.kernelVersion,
            inventory.arch,
            inventory.hostname,
            inventory.cpuModel,
            inventory.cpuCount,
            inventory.memoryTotalBytes,
            inventory.diskTotalBytes,
            inventory.virtualization,
            inventory.cloudProvider,
            inventory.timezone,
            inventory.bootedAt,
            inventory.runnerVersion,
            inventory.serviceManager,
            JSON.stringify(inventory.tools),
            JSON.stringify(inventory.facts),
            input.now,
          ],
        );
      }
      await this.metadata.insertTimeline(
        manager,
        host.id,
        this.mapper.toTimelineEntries(host.domainEvents),
        input.now,
      );
      await this.outbox.stageEvents(manager, host.domainEvents);
      return host;
    });

    if (!registered) return None;

    registered.clearEvents();
    await this.outbox.wake();
    return Some(registered);
  }

  /** The rows, each with its side tables: three primary-key reads for the whole list. */
  private async withMetadata(records: HostOrmEntity[]): Promise<HostPresence[]> {
    const metadata = await this.metadata.findForHosts(records.map((record) => record.id));
    return records.map((record) => {
      const found = metadata.get(record.id);
      return {
        host: this.mapper.toDomain(record, found),
        online: found?.online ?? false,
        inventory: found?.inventory ?? null,
        vitals: found?.vitals ?? null,
        network: found?.network ?? null,
      };
    });
  }
}
