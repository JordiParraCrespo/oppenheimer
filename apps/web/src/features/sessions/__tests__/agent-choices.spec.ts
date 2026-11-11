import { describe, expect, it } from 'vitest';
import { shownAgents, withAgentShown, withoutHidden } from '../lib/agent-choices';
import { toEngineAgents } from '../lib/session-options';

/**
 * A fresh device offers Claude Code, Codex, OpenCode, Grok and the blank
 * terminal; Pi and Oh My Pi wait to be switched on in Settings → Agents, and
 * any agent the reader switches off leaves the picker unless the draft is on
 * it. What breaks this: Pi showing on a fresh device, a switch that does not
 * survive (stored as the default it equals), or the draft's own agent
 * filtered out, which would leave the button naming nothing.
 */

const ids = (choices: readonly string[], current: string, hostCloud = false) =>
  withoutHidden(toEngineAgents(hostCloud, null), choices, current).map((option) => option.id);

describe('agent choices', () => {
  it('offers the four and the blank terminal on a fresh device', () => {
    expect(shownAgents([])).toEqual(['claude-code', 'codex', 'opencode', 'grok', 'shell']);
    expect(ids([], 'claude-code')).not.toContain('pi');
  });

  it('offers Pi once switched on, and takes Grok out once switched off', () => {
    const choices = withAgentShown(withAgentShown([], 'pi', true), 'grok', false);

    expect(choices).toEqual(['pi:on', 'grok:off']);
    expect(ids(choices, 'claude-code')).toContain('pi');
    expect(ids(choices, 'claude-code')).not.toContain('grok');
  });

  it('stores nothing for a switch back to the default', () => {
    expect(withAgentShown(['pi:on'], 'pi', false)).toEqual([]);
    expect(withAgentShown(['grok:off'], 'grok', true)).toEqual([]);
  });

  it('keeps the draft’s own agent, in a host’s cloud too', () => {
    expect(ids([], 'omp')).toContain('omp');
    expect(ids(['codex:off'], 'claude-code', true)).toEqual(['claude-code']);
    expect(ids(['codex:off'], 'codex', true)).toEqual(['claude-code', 'codex']);
  });
});
