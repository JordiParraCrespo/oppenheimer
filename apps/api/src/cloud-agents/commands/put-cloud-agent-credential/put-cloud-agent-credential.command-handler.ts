import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { CloudAgentResolver, requireOrganization } from '../../application/cloud-agent.resolver';
import { CLOUD_AGENT_CREDENTIAL_REPOSITORY, KEY_SEALER } from '../../cloud-agents.di-tokens';
import type { CloudAgentCredentialRepositoryPort } from '../../database/cloud-agent-credential.repository.port';
import { CloudAgentCredentialEntity, keyHintOf } from '../../domain/cloud-agent-credential.entity';
import { CloudAgentErrors } from '../../domain/cloud-agents.errors';
import type { KeySealerPort } from '../../infrastructure/key-sealer.port';
import { PutCloudAgentCredentialCommand } from './put-cloud-agent-credential.command';

/**
 * Connects a vendor with the caller's own key: the vendor is asked whose key
 * it is first, so a key it refuses (`CLOUD_AGENTS_005`) is never stored, and
 * the answer (the key's name, the account) is kept beside it, sealed, in place
 * of the caller's previous key for that vendor.
 */
@CommandHandler(PutCloudAgentCredentialCommand)
export class PutCloudAgentCredentialCommandHandler
  implements ICommandHandler<PutCloudAgentCredentialCommand, AggregateID>
{
  constructor(
    private readonly resolver: CloudAgentResolver,
    @Inject(KEY_SEALER) private readonly sealer: KeySealerPort,
    @Inject(CLOUD_AGENT_CREDENTIAL_REPOSITORY)
    private readonly credentials: CloudAgentCredentialRepositoryPort,
  ) {}

  async execute({ scope, provider, apiKey }: PutCloudAgentCredentialCommand): Promise<AggregateID> {
    const vendor = this.resolver.providerFor(provider);
    const organizationId = requireOrganization(scope);
    if (!this.sealer.isConfigured()) throw new AppError(CloudAgentErrors.NOT_CONFIGURED);
    const owner = await vendor.identify(apiKey);
    const credential = CloudAgentCredentialEntity.connect({
      organizationId,
      userId: scope.userId,
      provider: vendor.id,
      sealedKey: this.sealer.seal(apiKey),
      keyHint: keyHintOf(apiKey),
      keyName: owner.keyName.slice(0, 100),
      accountEmail: owner.email,
      accountId: owner.accountId,
    });
    await this.credentials.put(credential);
    return credential.id;
  }
}
