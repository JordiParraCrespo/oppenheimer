import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { BotProvider } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import { BotResource } from '../bots.resource';
import type { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
import { defaultBotProvider } from '../domain/model-provider-default.policy';
import { ModelProviderCredentialMapper } from '../model-provider-credential.mapper';
import { ModelProviderCredentialOrmEntity } from './model-provider-credential.orm-entity';
import type { ModelProviderCredentialRepositoryPort } from './model-provider-credential.repository.port';

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
    // UQ_model_provider_credential_provider: three rows at most.
    const records = await this.scopedQuery(scope).orderBy('credential.provider', 'ASC').getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOne(
    scope: AccessScope,
    provider: BotProvider,
  ): Promise<Option<ModelProviderCredentialEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('credential.provider = :provider', { provider })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findForRun(
    organizationId: string,
    provider: BotProvider,
  ): Promise<Option<ModelProviderCredentialEntity>> {
    const record = await this.repository.findOne({ where: { organizationId, provider } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async defaultProvider(scope: AccessScope): Promise<BotProvider> {
    return defaultBotProvider(await this.findAll(scope));
  }

  async put(credential: ModelProviderCredentialEntity): Promise<void> {
    // One row per workspace and provider: a second key replaces the first.
    // `markedDefault` is left out of the update, so a replaced key keeps its
    // mark; `setDefault` is the only writer of it.
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(ModelProviderCredentialOrmEntity)
      .values(this.mapper.toPersistence(credential))
      .orUpdate(
        ['sealedKey', 'keyHint', 'updatedByUserId', 'updatedAt'],
        ['organizationId', 'provider'],
      )
      .execute();
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
      if (!locked.some((row) => row.provider === provider)) return false;
      // The index is checked row by row: the old mark goes first.
      await rows.update({ organizationId, markedDefault: true }, { markedDefault: false });
      await rows.update({ organizationId, provider }, { markedDefault: true });
      return true;
    });
  }

  async delete(scope: AccessScope, provider: BotProvider): Promise<boolean> {
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

  async deleteIfUnchanged(credential: ModelProviderCredentialEntity): Promise<boolean> {
    const result = await this.repository.delete({
      id: credential.id,
      sealedKey: credential.sealedKey,
    });
    return result.affected === 1;
  }
}
