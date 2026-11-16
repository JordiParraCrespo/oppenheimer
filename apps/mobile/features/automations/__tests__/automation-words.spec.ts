import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { agentWords, nextRunWords, pausedReasonKey, runTone } from '../lib/automation-words';

/**
 * How the phone words an automation. What breaks if it drifts: a paused
 * automation that says when it runs next, a listening one with no next line,
 * a cancelled run drawn as a success, an unknown pause reason shown as its
 * own key path, and the wrong agent named.
 */
describe('an automation on the phone', () => {
  const automation = (over: Partial<AutomationEntity>) =>
    ({
      isPaused: false,
      nextRunAt: null,
      triggers: [],
      revision: { agent: 'claude-code', model: null, place: 'host' },
      ...over,
    }) as unknown as AutomationEntity;

  it('says nothing is next while paused, and the next event for one that only listens', () => {
    expect(nextRunWords(automation({ isPaused: true }), 0, 'en')).toEqual({
      key: 'automations.next.none',
    });
    const listening = automation({
      triggers: [{ source: 'github' }] as AutomationEntity['triggers'],
    });
    expect(nextRunWords(listening, 0, 'en')).toEqual({ key: 'automations.next.onEvent' });
  });

  it('draws a queued run as live and a cancelled or expired one as failed', () => {
    expect(runTone('queued')).toBe('running');
    expect(runTone('cancelled')).toBe('failed');
    expect(runTone('expired')).toBe('failed');
    expect(runTone('skipped')).toBe('completed');
  });

  it('reads a pause reason this build does not know as the generic line', () => {
    expect(pausedReasonKey(null)).toBe('automations.pausedReason.user');
    expect(pausedReasonKey('host_unpaired')).toBe('automations.pausedReason.host_unpaired');
    expect(pausedReasonKey('something_new')).toBe('automations.pausedReasonOther');
  });

  it('names the agent and its default model, and Claude Code’s cloud as a place', () => {
    expect(agentWords(automation({}), 'Claude Code cloud')).toMatch(/^Claude Code · /);
    const cloud = automation({
      revision: {
        agent: 'claude-code',
        model: null,
        place: 'claude-cloud',
      } as unknown as AutomationEntity['revision'],
    });
    expect(agentWords(cloud, 'Claude Code cloud')).toBe('Claude Code cloud');
  });
});
