import type { SessionStartStep } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { provisioningSteps, startFailure } from '../lib/provisioning-steps';

/**
 * A step says what it is doing while it runs and what came of it once it
 * lands — and every "what came of it" is something the host reported.
 */

// Key plus arguments, so an assertion reads which string and with what.
const t = ((key: string, args?: Record<string, unknown>) =>
  args ? `${key}${JSON.stringify(args)}` : key) as unknown as TFunction;

const at = (ms: number) => new Date(1_000_000 + ms);
const step = (
  id: SessionStartStep['id'],
  state: SessionStartStep['state'],
  startedAt: Date | null = null,
  finishedAt: Date | null = null,
): SessionStartStep => ({ id, state, startedAt, finishedAt });

const context = {
  host: 'studio',
  hostOnline: true,
  repo: 'xrp-mobile',
  branch: 'oppenheimer/amber-ember',
  agent: 'Claude Code',
  failure: null,
};

describe('provisioningSteps', () => {
  it('labels each step with the thing it acts on', () => {
    const [host, clone, worktree, agent] = provisioningSteps(
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
    expect(clone.label).toContain('steps.clone.label');
    expect(worktree.label).toContain('steps.worktree.label');
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

  it('says the host is offline rather than that it is being waited on', () => {
    const [host] = provisioningSteps(
      [step('host', 'running')],
      { ...context, hostOnline: false },
      t,
    );
    expect(host.meta).toContain('steps.host.offline');
  });

  it('gives a finished step the time the host says it took', () => {
    const [clone] = provisioningSteps([step('clone', 'done', at(0), at(1_340))], context, t);
    expect(clone.meta).toBe('sessions.provisioning.took{"seconds":"1.3"}');
  });

  it("puts the host's own words under the step that failed", () => {
    const [clone] = provisioningSteps(
      [step('clone', 'failed')],
      { ...context, failure: 'repository not found' },
      t,
    );
    expect(clone.meta).toBe('repository not found');
  });

  it('names the branch once the worktree is on it', () => {
    const [worktree] = provisioningSteps([step('worktree', 'done', at(0), at(200))], context, t);
    expect(worktree.meta).toBe('oppenheimer/amber-ember');
  });
});

describe('startFailure', () => {
  it('reads the detail of the last failure', () => {
    const events = [
      { seq: 1, kind: 'session.failed', payload: { detail: 'first' }, occurredAt: at(0) },
      { seq: 2, kind: 'session.failed', payload: { detail: 'second' }, occurredAt: at(1) },
    ];
    expect(startFailure(events)).toBe('second');
    expect(startFailure([])).toBeNull();
  });
});
