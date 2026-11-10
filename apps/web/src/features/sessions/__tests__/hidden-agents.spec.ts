import { describe, expect, it } from 'vitest';
import { shownAgents, withAgentShown } from '../lib/hidden-agents';
import { toEngineAgents } from '../lib/session-options';

/**
 * An agent hidden in Settings → Agents leaves New session's engine picker,
 * except the one the draft is already on, and an agent the catalog gains
 * later shows until somebody hides it. A regression that filtered the
 * draft's own agent out would leave the button naming nothing; one that
 * stored the shown list would hide every new agent.
 */

const ids = (hidden: readonly string[], current: string) =>
  toEngineAgents(false, null, hidden, current).map((option) => option.id);

describe('hidden agents', () => {
  it('leaves a hidden agent out of the picker, but never the draft’s own', () => {
    const hidden = withAgentShown([], 'grok', false);

    expect(ids(hidden, 'claude-code')).not.toContain('grok');
    expect(ids(hidden, 'grok')).toContain('grok');
    expect(ids(withAgentShown(hidden, 'grok', true), 'claude-code')).toContain('grok');
  });

  it('keeps what is hidden, so an agent nobody hid is shown', () => {
    const hidden = withAgentShown(withAgentShown([], 'pi', false), 'pi', false);

    expect(hidden).toEqual(['pi']);
    expect(shownAgents(hidden)).toContain('omp');
  });

  it('draws every agent rather than none when storage hides them all', () => {
    const everything = shownAgents([]);

    expect(ids(everything, '')).toEqual(everything);
  });

  it('offers Claude Code and Codex in a host’s cloud, hidden or not', () => {
    expect(toEngineAgents(true, null, ['codex'], 'claude-code').map((option) => option.id)).toEqual(
      ['claude-code', 'codex'],
    );
  });
});
