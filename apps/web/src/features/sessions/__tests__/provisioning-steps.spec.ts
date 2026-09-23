import type { SessionStartStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { provisioningSteps } from '../lib/provisioning-steps';

/**
 * A step says what it is doing while it runs and what came of it once it
 * lands. This file only turns the consumer's steps into `Stepper` rows.
 */

// Key plus arguments, so an assertion reads which string and with what.
const t = ((key: string, args?: Record<string, unknown>) =>
  args ? `${key}${JSON.stringify(args)}` : key) as unknown as TFunction;

const step = (
  id: SessionStartStep['id'],
  state: SessionStartStep['state'],
  durationMs: number | null = null,
): SessionStartStep => ({ id, state, durationMs });

const context = {
  host: 'studio',
  hostOffline: false,
  repo: 'xrp-mobile',
  branch: 'oppenheimer/amber-ember',
  agent: 'Claude Code',
  failure: null,
};

describe('provisioningSteps', () => {
  it('labels each step with the thing it acts on', () => {
    const [host, clone, , agent] = provisioningSteps(
      [
        step('host', 'running'),
        step('clone', 'pending'),
        step('worktree', 'pending'),
        step('agent', 'pending'),
      ],
      context,
      t,
    );
    expect(host.label).toContain('"host":"studio"');
    expect(clone.label).toContain('"repo":"xrp-mobile"');
    expect(agent.label).toContain('"agent":"Claude Code"');
  });

  it('says what a running step is doing, and nothing under a pending one', () => {
    const [clone, worktree] = provisioningSteps(
      [step('clone', 'running'), step('worktree', 'pending')],
      context,
      t,
    );
    expect(clone.meta).toBe('sessions.provisioning.steps.clone.doing');
    expect(worktree.meta).toBeUndefined();
  });

  it('says the host is away under a host step nobody has reported', () => {
    const [host] = provisioningSteps(
      [step('host', 'pending')],
      { ...context, hostOffline: true },
      t,
    );
    expect(host.meta).toContain('steps.host.offline');
  });

  it('shows the duration the host measured for a landed clone', () => {
    const [clone] = provisioningSteps([step('clone', 'done', 1340)], context, t);
    expect(clone.meta).toBe('sessions.provisioning.took{"seconds":"1.3"}');
  });

  it('names the branch once the worktree is on it', () => {
    const [worktree] = provisioningSteps([step('worktree', 'done', 200)], context, t);
    expect(worktree.meta).toBe('oppenheimer/amber-ember');
  });

  it("puts the host's own words under the step that failed", () => {
    const [clone] = provisioningSteps(
      [step('clone', 'failed')],
      { ...context, failure: 'repository not found' },
      t,
    );
    expect(clone.meta).toBe('repository not found');
  });
});
