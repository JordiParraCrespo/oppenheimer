import { heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';
import { injectable } from 'inversify';
import type { CloudAgentModel, CloudAgentStatusEntity } from './cloud-agent.entity';
import { CloudAgentsErrors } from './cloud-agents.errors';

type StatusDto = NonNullable<Awaited<ReturnType<typeof heyApiSdk.findCloudAgentStatus>>['data']>;

function toStatus(dto: StatusDto): CloudAgentStatusEntity {
  return {
    configured: dto.configured,
    available: dto.available,
    providers: dto.providers.map((row) => ({
      id: row.id,
      label: row.label,
      connected: row.connected,
      keyName: row.keyName,
      keyHint: row.keyHint,
      accountEmail: row.accountEmail,
      connectedAt: row.connectedAt ? new Date(row.connectedAt) : null,
    })),
  };
}

/**
 * The reader's keys for the vendors a cloud session runs on
 * (`product/next-steps/cloud-agents.md`), and the models each offers. The key
 * goes to the API once and never comes back.
 */
@injectable()
export class CloudAgentsRepository {
  @MapApiError(CloudAgentsErrors.STATUS_FAILED)
  async status(): Promise<CloudAgentStatusEntity> {
    return toStatus(
      await unwrapBody(heyApiSdk.findCloudAgentStatus(), CloudAgentsErrors.STATUS_FAILED),
    );
  }

  /** Checked with the vendor before it is stored; answers the status with it connected. */
  @MapApiError(CloudAgentsErrors.CONNECT_FAILED)
  async connect(provider: CloudAgentProviderId, apiKey: string): Promise<CloudAgentStatusEntity> {
    return toStatus(
      await unwrapBody(
        heyApiSdk.putCloudAgentCredential({ path: { provider }, body: { apiKey } }),
        CloudAgentsErrors.CONNECT_FAILED,
      ),
    );
  }

  @MapApiError(CloudAgentsErrors.DISCONNECT_FAILED)
  async disconnect(provider: CloudAgentProviderId): Promise<void> {
    await unwrap(
      heyApiSdk.removeCloudAgentCredential({ path: { provider } }),
      CloudAgentsErrors.DISCONNECT_FAILED,
    );
  }

  @MapApiError(CloudAgentsErrors.MODELS_FAILED)
  async models(provider: CloudAgentProviderId): Promise<CloudAgentModel[]> {
    const data = await unwrapBody(
      heyApiSdk.findCloudAgentModels({ path: { provider } }),
      CloudAgentsErrors.MODELS_FAILED,
    );
    return data.map((row) => ({ id: row.id, label: row.label }));
  }
}
