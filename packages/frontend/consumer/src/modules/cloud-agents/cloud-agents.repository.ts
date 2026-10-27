import { heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import type {
  CloudAgentProviderId,
  LaunchCloudAgentDto,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { injectable } from 'inversify';
import {
  CloudAgentEntity,
  type CloudAgentModel,
  type CloudAgentStatusEntity,
} from './cloud-agent.entity';
import { CloudAgentsErrors } from './cloud-agents.errors';

type CloudAgentDto = NonNullable<Awaited<ReturnType<typeof heyApiSdk.findCloudAgent>>['data']>;
type StatusDto = NonNullable<Awaited<ReturnType<typeof heyApiSdk.findCloudAgentStatus>>['data']>;

function toEntity(dto: CloudAgentDto): CloudAgentEntity {
  return new CloudAgentEntity(
    dto.id,
    dto.provider,
    dto.externalId,
    dto.url,
    dto.name,
    dto.prompt,
    dto.repositoryUrl,
    dto.startingRef,
    dto.model,
    dto.autoCreatePr,
    dto.status,
    dto.branch,
    dto.pullRequestUrl,
    dto.summary,
    new Date(dto.syncedAt),
    new Date(dto.createdAt),
  );
}

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
 * Cloud agents (`product/next-steps/cloud-agents.md`): coding agents run in a
 * vendor's cloud on the reader's own key for it, launched and followed from
 * the console. The key goes to the API once and never comes back.
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

  @MapApiError(CloudAgentsErrors.LIST_FAILED)
  async findAll(): Promise<CloudAgentEntity[]> {
    const data = await unwrapBody(heyApiSdk.findCloudAgents(), CloudAgentsErrors.LIST_FAILED);
    return data.map(toEntity);
  }

  @MapApiError(CloudAgentsErrors.LOAD_FAILED)
  async findOne(id: string): Promise<CloudAgentEntity> {
    return toEntity(
      await unwrapBody(heyApiSdk.findCloudAgent({ path: { id } }), CloudAgentsErrors.LOAD_FAILED),
    );
  }

  @MapApiError(CloudAgentsErrors.LAUNCH_FAILED)
  async launch(input: LaunchCloudAgentDto): Promise<CloudAgentEntity> {
    return toEntity(
      await unwrapBody(
        heyApiSdk.launchCloudAgent({ body: input }),
        CloudAgentsErrors.LAUNCH_FAILED,
      ),
    );
  }

  @MapApiError(CloudAgentsErrors.FOLLOW_UP_FAILED)
  async followUp(id: string, prompt: string): Promise<CloudAgentEntity> {
    return toEntity(
      await unwrapBody(
        heyApiSdk.followUpCloudAgent({ path: { id }, body: { prompt } }),
        CloudAgentsErrors.FOLLOW_UP_FAILED,
      ),
    );
  }

  @MapApiError(CloudAgentsErrors.CANCEL_FAILED)
  async cancel(id: string): Promise<CloudAgentEntity> {
    return toEntity(
      await unwrapBody(
        heyApiSdk.cancelCloudAgent({ path: { id } }),
        CloudAgentsErrors.CANCEL_FAILED,
      ),
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

  /** The repositories the vendor can reach for the reader, as URLs. */
  @MapApiError(CloudAgentsErrors.REPOSITORIES_FAILED)
  async repositories(provider: CloudAgentProviderId): Promise<string[]> {
    const data = await unwrapBody(
      heyApiSdk.findCloudAgentRepositories({ path: { provider } }),
      CloudAgentsErrors.REPOSITORIES_FAILED,
    );
    return data.map((row) => row.url);
  }
}
