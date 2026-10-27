import { describe, expect, it } from 'vitest';
import { CloudAgentEntity, repositoryNameOf } from '../cloud-agent.entity';

/**
 * What the console reads off a cloud agent: whether to keep asking about it,
 * and the repository's short name the facts card and the picker show.
 */

function agent(status: CloudAgentEntity['status']): CloudAgentEntity {
  return new CloudAgentEntity(
    'agent-1',
    'cursor',
    'bc-agent-1',
    null,
    'Fix the login page',
    'Fix the login page',
    'https://github.com/acme/api',
    null,
    null,
    false,
    status,
    null,
    null,
    null,
    new Date(0),
    new Date(0),
  );
}

describe('CloudAgentEntity', () => {
  it('is active while its run is starting or working, and settled once it ended', () => {
    expect(agent('starting').isActive).toBe(true);
    expect(agent('running').isActive).toBe(true);
    for (const status of ['finished', 'failed', 'cancelled', 'expired'] as const) {
      expect(agent(status).isActive).toBe(false);
    }
  });

  it('names a GitHub repository by owner and name, and leaves any other URL whole', () => {
    expect(agent('running').repositoryName).toBe('acme/api');
    expect(repositoryNameOf('https://github.com/acme/web.git')).toBe('acme/web');
    expect(repositoryNameOf('https://gitlab.com/acme/api')).toBe('https://gitlab.com/acme/api');
  });
});
