import { heyApiSdk } from '@oppenheimer/api-client';
import { callApi } from '@oppenheimer/frontend-core';
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
  status(): Promise<CloudAgentStatusEntity> {
    return callApi(CloudAgentsErrors.STATUS_FAILED, async (api) => {
      return toStatus(await api.body(heyApiSdk.findCloudAgentStatus()));
    });
  }

  /** Checked with the vendor before it is stored; answers the status with it connected. */
  connect(provider: CloudAgentProviderId, apiKey: string): Promise<CloudAgentStatusEntity> {
    return callApi(CloudAgentsErrors.CONNECT_FAILED, async (api) => {
      return toStatus(
        await api.body(heyApiSdk.putCloudAgentCredential({ path: { provider }, body: { apiKey } })),
      );
    });
  }

  disconnect(provider: CloudAgentProviderId): Promise<void> {
    return callApi(CloudAgentsErrors.DISCONNECT_FAILED, async (api) => {
      await api.result(heyApiSdk.removeCloudAgentCredential({ path: { provider } }));
    });
  }

  models(provider: CloudAgentProviderId): Promise<CloudAgentModel[]> {
    return callApi(CloudAgentsErrors.MODELS_FAILED, async (api) => {
      const data = await api.body(heyApiSdk.findCloudAgentModels({ path: { provider } }));
      return data.map((row) => ({ id: row.id, label: row.label }));
    });
  }
}
