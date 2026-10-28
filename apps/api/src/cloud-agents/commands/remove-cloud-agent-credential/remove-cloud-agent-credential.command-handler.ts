import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CloudAgentResolver, requireOrganization } from '../../application/cloud-agent.resolver';
import { CLOUD_AGENT_CREDENTIAL_REPOSITORY } from '../../cloud-agents.di-tokens';
import type { CloudAgentCredentialRepositoryPort } from '../../database/cloud-agent-credential.repository.port';
import { RemoveCloudAgentCredentialCommand } from './remove-cloud-agent-credential.command';

/**
 * Forgets the caller's key for a vendor. Their agents stay listed, as they
 * were last heard of, and the vendor keeps running them; connecting a key
 * again picks them up. Removing a key that is not there does nothing.
 */
@CommandHandler(RemoveCloudAgentCredentialCommand)
export class RemoveCloudAgentCredentialCommandHandler
  implements ICommandHandler<RemoveCloudAgentCredentialCommand, void>
{
  constructor(
    private readonly resolver: CloudAgentResolver,
    @Inject(CLOUD_AGENT_CREDENTIAL_REPOSITORY)
    private readonly credentials: CloudAgentCredentialRepositoryPort,
  ) {}

  async execute({ scope, provider }: RemoveCloudAgentCredentialCommand): Promise<void> {
    const vendor = this.resolver.providerFor(provider);
    requireOrganization(scope);
    await this.credentials.deleteOwn(scope, vendor.id);
  }
}
