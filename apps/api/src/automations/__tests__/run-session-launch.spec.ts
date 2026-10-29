import { describe, expect, it } from 'vitest';
import { AutomationRunMapper } from '../automation-run.mapper';
import { AutomationEntity, type RevisionInput } from '../domain/automation.entity';
import { runRefusalOf } from '../domain/run-refusal.policy';
import { triggerFromInput } from '../domain/trigger-config.policy';

/**
 * Where a run's session starts (`AUTOMATION_PLACES`): on the host with its
 * permission and effort, in Claude Code's cloud from the host as a
 * `cloud: true` create, or at a vendor with no host. A launch the vendor
 * refuses for the owner's key pauses the automation rather than failing
 * every run. The guards and the commands that carry these out are the
 * integration suite's.
 */
const repository = { installationId: 'inst-1', githubRepoId: '101', fullName: 'acme/atlas' };

function automation(revision: Partial<RevisionInput>) {
  return AutomationEntity.createNew({
    organizationId: 'org-1',
    projectId: 'project-1',
    ownerUserId: 'user-1',
    name: 'Nightly audit',
    revision: {
      place: 'host',
      hostId: 'host-1',
      agent: 'claude-code',
      model: null,
      permission: 'full',
      effort: null,
      prompt: 'Audit the manifests.',
      repositories: [repository],
      createdByUserId: 'user-1',
      ...revision,
    },
    triggers: [
      triggerFromInput(
        { source: 'schedule', frequency: 'daily', hour: 9, minute: 0, timezone: 'UTC' },
        0,
      ),
    ],
    active: true,
    now: new Date(),
  });
}

const launchOf = (entity: AutomationEntity) =>
  new AutomationRunMapper().toSessionLaunch(entity, { repository, baseBranch: 'main' }, 'Go');

describe('the session a run starts', () => {
  it('starts a worktree on the host with the permission the revision holds', () => {
    expect(launchOf(automation({}))).toEqual({
      kind: 'host',
      input: expect.objectContaining({
        hostId: 'host-1',
        agent: 'claude-code',
        checkouts: [{ installationId: 'inst-1', githubRepoId: 101, baseBranch: 'main' }],
        launch: { permission: 'full' },
        prompt: 'Go',
      }),
    });
  });

  it('starts Claude Code’s cloud from the host, with no permission to send', () => {
    const { kind, input } = launchOf(automation({ place: 'claude-cloud', model: 'opus' }));
    expect(kind).toBe('host');
    expect(input).toMatchObject({ hostId: 'host-1', cloud: true, launch: { model: 'opus' } });
    expect(input).not.toHaveProperty('launch.permission');
  });

  it('launches a vendor’s agent with no host, on the run’s repository', () => {
    expect(launchOf(automation({ place: 'cursor', hostId: null, agent: 'cursor' }))).toEqual({
      kind: 'vendor',
      input: {
        provider: 'cursor',
        projectId: 'project-1',
        checkout: { installationId: 'inst-1', githubRepoId: 101, baseBranch: 'main' },
        prompt: 'Go',
      },
    });
  });

  it('refuses a vendor’s place with a host, or a host place with a vendor’s agent', () => {
    expect(() => automation({ place: 'cursor', agent: 'cursor' })).toThrow();
    expect(() => automation({ place: 'host', agent: 'cursor' })).toThrow();
    expect(() => automation({ place: 'claude-cloud', agent: 'codex' })).toThrow();
    expect(() => automation({ place: 'host', hostId: null })).toThrow();
  });
});

describe('a vendor refusing a run', () => {
  it('pauses the automation when the owner has no key, or the vendor refused it', () => {
    expect(runRefusalOf('CLOUD_AGENTS_004')).toEqual({
      reason: 'not_launchable',
      pause: 'cloud_key_missing',
    });
    expect(runRefusalOf('CLOUD_AGENTS_005')?.pause).toBe('cloud_key_missing');
  });

  it('skips a launch the vendor refused, and retries one it did not answer', () => {
    expect(runRefusalOf('CLOUD_AGENTS_010')).toEqual({ reason: 'not_launchable', pause: null });
    expect(runRefusalOf('CLOUD_AGENTS_006')).toBeNull();
  });
});
