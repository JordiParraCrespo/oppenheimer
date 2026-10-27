import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import {
  CLOUD_AGENT_CREDENTIAL_REPOSITORY,
  CURSOR_CLOUD_AGENTS,
  KEY_SEALER,
} from '../cloud-agents.di-tokens';
import type { CloudAgentCredentialRepositoryPort } from '../database/cloud-agent-credential.repository.port';
import type { CloudAgentRunState } from '../domain/cloud-agent.entity';
import { CloudAgentErrors } from '../domain/cloud-agents.errors';
import type {
  CursorAccess,
  CursorCloudAgentsPort,
} from '../infrastructure/cursor-cloud-agents.port';
import type { KeySealerPort } from '../infrastructure/key-sealer.port';
import type {
  CloudAgentKeyOwner,
  CloudAgentLaunch,
  CloudAgentModel,
  CloudAgentProvider,
  LaunchedCloudAgent,
} from './cloud-agent-provider.port';

/**
 * Cursor's Cloud Agents, on the caller's own Cursor key. The key is the
 * person's, stored sealed, opened per call, and never sent anywhere but
 * Cursor; it bills the person's own Cursor plan.
 */
@Injectable()
export class CursorCloudAgentResolver implements CloudAgentProvider<CursorAccess> {
  readonly id = 'cursor' as const;

  constructor(
    @Inject(CLOUD_AGENT_CREDENTIAL_REPOSITORY)
    private readonly credentials: CloudAgentCredentialRepositoryPort,
    @Inject(KEY_SEALER) private readonly sealer: KeySealerPort,
    @Inject(CURSOR_CLOUD_AGENTS) private readonly cursor: CursorCloudAgentsPort,
  ) {}

  async availableFor(organizationId: string, userId: string): Promise<boolean> {
    if (!this.sealer.isConfigured()) return false;
    return (await this.credentials.findFor(organizationId, userId, this.id)).isSome();
  }

  async identify(apiKey: string): Promise<CloudAgentKeyOwner> {
    const owner = await this.cursor.me(apiKey);
    return { keyName: owner.keyName, email: owner.email, accountId: owner.userId };
  }

  async grantFor(organizationId: string, userId: string): Promise<CursorAccess> {
    const stored = await this.credentials.findFor(organizationId, userId, this.id);
    if (stored.isNone() || !this.sealer.isConfigured()) {
      throw new AppError(CloudAgentErrors.NOT_CONNECTED, { detail: 'No Cursor key is stored' });
    }
    const credential = stored.unwrap();
    let apiKey: string;
    try {
      apiKey = this.sealer.open(credential.sealedKey);
    } catch {
      // Sealed under a key the server no longer has: as good as none.
      throw new AppError(CloudAgentErrors.NOT_CONNECTED, {
        detail: 'The stored Cursor key can no longer be opened; connect it again',
      });
    }
    return {
      apiKey,
      bucket: credential.accountId ? `user:${credential.accountId}` : `credential:${credential.id}`,
    };
  }

  async launch(access: CursorAccess, launch: CloudAgentLaunch): Promise<LaunchedCloudAgent> {
    const { agentId, name, url, ...run } = await this.cursor.launch(access, {
      agentId: launch.id,
      prompt: launch.prompt,
      repositoryUrl: launch.repositoryUrl,
      startingRef: launch.startingRef,
      model: launch.model,
      autoCreatePr: launch.autoCreatePr,
    });
    return { externalId: agentId, name, url, run };
  }

  followUp(access: CursorAccess, externalId: string, prompt: string): Promise<string> {
    return this.cursor.followUp(access, externalId, prompt);
  }

  cancel(access: CursorAccess, externalId: string, runId: string): Promise<void> {
    return this.cursor.cancel(access, externalId, runId);
  }

  read(access: CursorAccess, externalId: string, runId: string): Promise<CloudAgentRunState> {
    return this.cursor.read(access, externalId, runId);
  }

  models(access: CursorAccess): Promise<CloudAgentModel[]> {
    return this.cursor.models(access);
  }

  repositories(access: CursorAccess): Promise<string[]> {
    return this.cursor.repositories(access);
  }
}
