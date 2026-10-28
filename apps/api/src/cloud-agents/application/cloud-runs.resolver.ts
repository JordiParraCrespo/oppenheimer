import { Injectable } from '@nestjs/common';
import type { CloudAgentProviderId } from '@oppenheimer/shared';
import { CloudAgentResolver } from './cloud-agent.resolver';
import type {
  CloudAgentLaunch,
  CloudAgentRunState,
  CloudRunOwner,
  CloudRunsPort,
  LaunchedCloudAgent,
} from './cloud-runs.port';

/** {@link CloudRunsPort} over the provider the session names, with no fallback (`CloudAgentResolver`). */
@Injectable()
export class CloudRunsResolver implements CloudRunsPort {
  constructor(private readonly resolver: CloudAgentResolver) {}

  async launch(
    owner: CloudRunOwner,
    provider: CloudAgentProviderId,
    launch: CloudAgentLaunch,
  ): Promise<LaunchedCloudAgent> {
    const call = await this.resolver.callForOwner(owner, provider);
    return call.provider.launch(call.grant, launch);
  }

  async read(
    owner: CloudRunOwner,
    provider: CloudAgentProviderId,
    externalId: string,
    runId: string,
  ): Promise<CloudAgentRunState> {
    const call = await this.resolver.callForOwner(owner, provider);
    return call.provider.read(call.grant, externalId, runId);
  }
}
