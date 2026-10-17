import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import type { BotProvider } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import { BotResource } from '../bots.resource';
import type { ModelProviderCredentialEntity } from '../domain/model-provider-credential.entity';
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

  async put(credential: ModelProviderCredentialEntity): Promise<void> {
    // One row per workspace and provider: a second key replaces the first.
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
