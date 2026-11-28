import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { type BotProvider, MODEL_PROVIDER_KEYS_MAX, type ModelProvider } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, IsNull, Not, Repository } from 'typeorm';
import { BotResource } from '../bots.resource';
import type { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { defaultBotProvider } from '../domain/model-provider-default.policy';
import { keysInStoredOrder, keysInTurnOrder } from '../domain/model-provider-key-order.policy';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';
import { ModelProviderCredentialOrmEntity } from './model-provider-credential.orm-entity';
import type {
  AddModelProviderKeyOutcome,
  ModelProviderCredentialRepositoryPort,
} from './model-provider-credential.repository.port';

function firstOf<T>(items: readonly T[]): Option<T> {
  return items.length > 0 ? Some(items[0]) : None;
}

@Injectable()
export class ModelProviderCredentialRepository
  extends ScopedRepositoryBase<ModelProviderCredentialOrmEntity>
  implements ModelProviderCredentialRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'credential';

  constructor(
    @InjectRepository(ModelProviderCredentialOrmEntity)
    protected readonly repository: Repository<ModelProviderCredentialOrmEntity>,
    private readonly mapper: ModelProviderCredentialMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope): Promise<ModelProviderCredentialEntity[]> {
    const records = await this.scopedQuery(scope)
      .orderBy('credential.provider', 'ASC')
      .addOrderBy('credential.position', 'ASC')
      .addOrderBy('credential.createdAt', 'ASC')
      .addOrderBy('credential.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOne(
    scope: AccessScope,
    provider: ModelProvider,
  ): Promise<Option<ModelProviderCredentialEntity>> {
    const records = await this.scopedQuery(scope)
      .andWhere('credential.provider = :provider', { provider })
      .getMany();
    return firstOf(keysInTurnOrder(records.map((record) => this.mapper.toDomain(record))));
  }

  async findForRun(
    organizationId: string,
    provider: ModelProvider,
  ): Promise<Option<ModelProviderCredentialEntity>> {
    return firstOf(await this.findAllForRun(organizationId, provider));
  }

  async findAllForRun(
    organizationId: string,
    provider: ModelProvider,
  ): Promise<ModelProviderCredentialEntity[]> {
    // IDX_model_provider_credential_order; MODEL_PROVIDER_KEYS_MAX rows at most.
    const records = await this.repository.find({ where: { organizationId, provider } });
    return keysInTurnOrder(records.map((record) => this.mapper.toDomain(record)));
  }

  async defaultProvider(scope: AccessScope): Promise<BotProvider> {
    return defaultBotProvider(await this.findAll(scope));
  }

  async put(credential: ModelProviderCredentialEntity): Promise<void> {
    const { organizationId, provider } = credential;
    await this.repository.manager.transaction(async (manager) => {
      const rows = await this.lockedKeys(manager, organizationId, provider);
      const first = keysInStoredOrder(rows)[0];
      if (!first) {
        await manager.insert(
          ModelProviderCredentialOrmEntity,
          this.mapper.toPersistence(credential),
        );
        return;
      }
      // The first key's row keeps its id, place and mark: only the secret changes.
      await manager.update(
        ModelProviderCredentialOrmEntity,
        { id: first.id },
        {
          sealedKey: credential.sealedKey,
          keyHint: credential.keyHint,
          updatedByUserId: credential.updatedByUserId,
          spentAt: null,
        },
      );
    });
  }

  async add(credential: ModelProviderCredentialEntity): Promise<AddModelProviderKeyOutcome> {
    const { organizationId, provider } = credential;
    return this.repository.manager.transaction(async (manager) => {
      // The count and the insert under one lock: two adds at nine keys store one.
      const rows = await this.lockedKeys(manager, organizationId, provider);
      if (rows.length >= MODEL_PROVIDER_KEYS_MAX) return 'full';
      const record = this.mapper.toPersistence(credential);
      record.position = rows.reduce((last, row) => Math.max(last, row.position + 1), 0);
      await manager.insert(ModelProviderCredentialOrmEntity, record);
      return 'added';
    });
  }

  async replaceKey(
    scope: AccessScope,
    provider: ModelProvider,
    keyId: string,
    sealedKey: Buffer,
    keyHint: string,
  ): Promise<boolean> {
    const { organizationId, userId } = scope;
    if (!organizationId) return false;
    const result = await this.repository.update(
      { id: keyId, organizationId, provider },
      { sealedKey, keyHint, updatedByUserId: userId ?? null, spentAt: null },
    );
    return result.affected === 1;
  }

  async deleteKey(scope: AccessScope, provider: ModelProvider, keyId: string): Promise<boolean> {
    const { organizationId } = scope;
    if (!organizationId) return false;
    return this.repository.manager.transaction(async (manager) => {
      const rows = await this.lockedKeys(manager, organizationId, provider);
      // The workspace's rows too, as `setDefault` locks them: a switch of default
      // under way moves the mark first, and this reads where it landed.
      const marks = await manager
        .getRepository(ModelProviderCredentialOrmEntity)
        .createQueryBuilder('credential')
        .setLock('pessimistic_write')
        .where('credential.organizationId = :organizationId', { organizationId })
        .getMany();
      const removed = marks.find((row) => row.id === keyId && row.provider === provider);
      if (!removed) return false;
      await manager.delete(ModelProviderCredentialOrmEntity, { id: keyId });
      // The provider stays the default while it has a key: the next one takes the mark.
      const next = keysInStoredOrder(rows.filter((row) => row.id !== keyId))[0];
      if (removed.markedDefault && next) {
        await manager.update(
          ModelProviderCredentialOrmEntity,
          { id: next.id },
          { markedDefault: true },
        );
      }
      return true;
    });
  }

  async markSpent(credential: ModelProviderCredentialEntity, at: Date): Promise<boolean> {
    const result = await this.repository.update(
      { id: credential.id, sealedKey: credential.sealedKey },
      { spentAt: at },
    );
    return result.affected === 1;
  }

  async clearSpent(credential: ModelProviderCredentialEntity): Promise<void> {
    await this.repository.update(
      { id: credential.id, sealedKey: credential.sealedKey, spentAt: Not(IsNull()) },
      { spentAt: null },
    );
  }

  async setDefault(scope: AccessScope, provider: BotProvider): Promise<boolean> {
    const { organizationId } = scope;
    if (!organizationId) return false;
    return this.repository.manager.transaction(async (manager) => {
      const rows = manager.getRepository(ModelProviderCredentialOrmEntity);
      // Two switches at once would both clear, then collide on
      // UQ_model_provider_credential_default: the workspace's rows are locked
      // first, so the second waits and runs on what the first left.
      const locked = await rows
        .createQueryBuilder('credential')
        .setLock('pessimistic_write')
        .where('credential.organizationId = :organizationId', { organizationId })
        .getMany();
      const first = keysInStoredOrder(locked.filter((row) => row.provider === provider))[0];
      if (!first) return false;
      // The index is checked row by row: the old mark goes first.
      await rows.update({ organizationId, markedDefault: true }, { markedDefault: false });
      await rows.update({ id: first.id }, { markedDefault: true });
      return true;
    });
  }

  async delete(scope: AccessScope, provider: ModelProvider): Promise<boolean> {
    if (!scope.organizationId) return false;
    const result = await this.repository.delete({
      organizationId: scope.organizationId,
      provider,
    });
    return (result.affected ?? 0) > 0;
  }

  async replaceSecretIfUnchanged(
    credential: ModelProviderCredentialEntity,
    sealedKey: Buffer,
    keyHint: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { id: credential.id, sealedKey: credential.sealedKey },
      { sealedKey, keyHint },
    );
    return result.affected === 1;
  }

  /**
   * The provider's keys, read under a lock on the workspace and provider, so
   * adds, removals and replacements of its first key run one at a time. An
   * advisory lock rather than `FOR UPDATE`, which would not hold back a
   * concurrent insert.
   */
  private async lockedKeys(
    manager: EntityManager,
    organizationId: string,
    provider: ModelProvider,
  ): Promise<ModelProviderCredentialOrmEntity[]> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `model_provider_credential:${organizationId}:${provider}`,
    ]);
    return manager.find(ModelProviderCredentialOrmEntity, { where: { organizationId, provider } });
  }

  async deleteIfUnchanged(credential: ModelProviderCredentialEntity): Promise<boolean> {
    const result = await this.repository.delete({
      id: credential.id,
      sealedKey: credential.sealedKey,
    });
    return result.affected === 1;
  }
}
