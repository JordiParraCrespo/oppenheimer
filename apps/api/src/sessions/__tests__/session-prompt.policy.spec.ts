import { describe, expect, it } from 'vitest';
import {
  CLOUD_UNCONFIRMED_HOLD_SECONDS,
  cloudPromptRefusal,
  PROMPT_SETTLE_SECONDS,
  promptKeys,
  promptRefusal,
} from '../domain/session-prompt.policy';

/**
 * When a bot's follow-up prompt may be typed: only into an open session whose
 * agent is at its prompt, and not while another prompt it has not taken yet
 * is waiting, unless that one has sat unclaimed past the settle window. The
 * claim under the row lock is the command handler's spec.
 */
const NOW = new Date('2026-10-27T10:00:00Z');
const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);
const open = (lastObservedState: 'idle' | 'working' | 'blocked' | null, quietFor = 5) => ({
  state: 'open' as const,
  lastObservedState,
  lastEventAt: secondsAgo(quietFor),
});
const queuedFollowUp = { origin: 'follow_up' as const, state: 'queued' as const };

describe('promptRefusal', () => {
  it('lets an agent at its prompt, or one that never reports, take a prompt', () => {
    expect(promptRefusal(open('idle'), null, NOW)).toBeNull();
    expect(promptRefusal(open(null), null, NOW)).toBeNull();
  });

  it('refuses a session that is not running, and an agent at work or blocked', () => {
    expect(promptRefusal({ ...open('idle'), state: 'starting' }, null, NOW)).toContain('starting');
    expect(promptRefusal(open('working'), null, NOW)).toContain('working');
    expect(promptRefusal(open('blocked'), null, NOW)).toContain('question');
  });

  it('holds a second prompt while the first waits to be taken, until the settle window passes', () => {
    expect(promptRefusal(open('idle', 5), queuedFollowUp, NOW)).toContain('just sent');
    expect(promptRefusal(open('idle', PROMPT_SETTLE_SECONDS), queuedFollowUp, NOW)).toBeNull();
  });

  it('does not count a person’s own task waiting to start as a prompt in flight', () => {
    expect(promptRefusal(open('idle'), { origin: 'person', state: 'queued' }, NOW)).toBeNull();
  });
});

describe('cloudPromptRefusal', () => {
  const now = new Date('2026-11-05T12:00:00.000Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
  const fold = (lastEventAt: Date) => ({
    state: 'open' as const,
    lastObservedState: 'done' as const,
    lastEventAt,
  });
  const unconfirmed = { origin: 'follow_up' as const, state: 'queued' as const };

  it('waits while the agent is on a run', () => {
    expect(cloudPromptRefusal({ isActive: true }, fold(ago(600)), null, now)).toMatch(
      /still on its last run/,
    );
  });

  // The regression: a follow-up whose vendor call timed out (it may be running
  // at the vendor) sent again a minute later, running the instruction twice on
  // the launcher's key.
  it('holds off the next follow-up while an earlier one is unconfirmed, then lets it through', () => {
    const run = { isActive: false };
    expect(cloudPromptRefusal(run, fold(ago(5 * 60)), unconfirmed, now)).toMatch(/not confirmed/);
    expect(
      cloudPromptRefusal(run, fold(ago(CLOUD_UNCONFIRMED_HOLD_SECONDS + 1)), unconfirmed, now),
    ).toBeNull();
    expect(
      cloudPromptRefusal(run, fold(ago(5)), { origin: 'follow_up', state: 'completed' }, now),
    ).toBeNull();
  });
});

// What breaks this: a bot's follow-up typed after the prompt ZCode recalled
// into its input (an Up arrow on an empty prompt), and sent joined to it.
describe('promptKeys', () => {
  it("empties ZCode's prompt before the words, and types the words alone for any other agent", () => {
    expect(promptKeys('run the tests', 'zcode')).toEqual(['\u0015', 'run the tests', '\r']);
    expect(promptKeys('run the tests', 'claude-code')).toEqual(['run the tests', '\r']);
    expect(promptKeys('two\nlines', 'claude-code')).toEqual([
      '\u001b[200~two\nlines\u001b[201~',
      '\r',
    ]);
  });
});
