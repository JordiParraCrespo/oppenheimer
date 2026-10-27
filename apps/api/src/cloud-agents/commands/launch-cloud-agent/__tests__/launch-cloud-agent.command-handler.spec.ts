import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { describe, expect, it, vi } from 'vitest';
import type { CloudAgentResolver } from '../../../application/cloud-agent.resolver';
import type { CloudAgentProvider } from '../../../application/cloud-agent-provider.port';
import type { CloudAgentRepositoryPort } from '../../../database/cloud-agent.repository.port';
import { CloudAgentErrors } from '../../../domain/cloud-agents.errors';
import { LaunchCloudAgentCommand } from '../launch-cloud-agent.command';
import { LaunchCloudAgentCommandHandler } from '../launch-cloud-agent.command-handler';

/**
 * A launch asks the vendor first and keeps what it answered under the id it
 * chose before asking; a vendor that refuses leaves nothing stored.
 */

const scope = { organizationId: 'org-1', userId: 'user-1' } as unknown as AccessScope;
const INPUT = {
  provider: 'cursor' as const,
  prompt: 'Fix the login page',
  repositoryUrl: 'https://github.com/acme/api',
  autoCreatePr: false,
};

function setup(launch: CloudAgentProvider['launch']) {
  const provider = { id: 'cursor', launch } as unknown as CloudAgentProvider;
  const resolver = {
    callFor: vi.fn().mockResolvedValue({ provider, grant: 'grant' }),
  } as unknown as CloudAgentResolver;
  const agents: Pick<CloudAgentRepositoryPort, 'insert'> = { insert: vi.fn() };
  const handler = new LaunchCloudAgentCommandHandler(resolver, agents as CloudAgentRepositoryPort);
  return { handler, agents, provider };
}

describe('LaunchCloudAgentCommandHandler', () => {
  it('stores the agent the vendor started, under the id it was launched with', async () => {
    const launch = vi.fn().mockResolvedValue({
      externalId: 'bc-x',
      name: 'Fix the login page',
      url: 'https://cursor.com/agents/bc-x',
      run: {
        runId: 'run-1',
        status: 'starting',
        branch: null,
        pullRequestUrl: null,
        summary: null,
      },
    });
    const { handler, agents } = setup(launch);

    const id = await handler.execute(new LaunchCloudAgentCommand({ scope, input: INPUT }));

    expect(launch).toHaveBeenCalledWith('grant', {
      id,
      prompt: 'Fix the login page',
      repositoryUrl: 'https://github.com/acme/api',
      startingRef: null,
      model: null,
      autoCreatePr: false,
    });
    const stored = vi.mocked(agents.insert).mock.calls[0][0];
    expect(stored).toMatchObject({ id });
    expect(stored.externalId).toBe('bc-x');
    expect(stored.createdByUserId).toBe('user-1');
    expect(stored.status).toBe('starting');
  });

  it('stores nothing when the vendor refuses the launch', async () => {
    const { handler, agents } = setup(
      vi.fn().mockRejectedValue(new AppError(CloudAgentErrors.REQUEST_REFUSED)),
    );

    await expect(
      handler.execute(new LaunchCloudAgentCommand({ scope, input: INPUT })),
    ).rejects.toMatchObject({ code: 'CLOUD_AGENTS_010' });
    expect(agents.insert).not.toHaveBeenCalled();
  });
});
