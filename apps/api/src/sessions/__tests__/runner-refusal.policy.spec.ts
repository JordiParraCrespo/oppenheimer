import { describe, expect, it } from 'vitest';
import { runnerCanStart, runnerRefusal, runnerTakesPlace } from '../domain/runner-refusal.policy';

/**
 * The one rule for whether a host's runner can take a session: the agent from
 * its stored inventory, the place from its live link's capabilities. The
 * create handler's spec covers the refusal reaching a caller before anything is
 * written; the relay dispatch adapter's spec the same rule at hello.
 */

const beforeGrok = ['git', 'tmux', 'claude', 'codex', 'opencode'];

describe('runnerCanStart', () => {
  it('refuses an agent whose command the runner never probed', () => {
    expect(runnerCanStart('grok', beforeGrok)).toBe(false);
    expect(runnerCanStart('grok', [...beforeGrok, 'grok'])).toBe(true);
    expect(runnerCanStart('claude-code', beforeGrok)).toBe(true);
  });

  it('allows what it cannot judge: no inventory yet, the blank terminal, an unknown id', () => {
    expect(runnerCanStart('grok', null)).toBe(true);
    expect(runnerCanStart('shell', [])).toBe(true);
    expect(runnerCanStart('cursor', beforeGrok)).toBe(true);
  });
});

describe('runnerTakesPlace', () => {
  it('takes a worktree session from any runner, a folder session only from one that said so', () => {
    expect(runnerTakesPlace('worktree', [])).toBe(true);
    expect(runnerTakesPlace('folder', ['session.image'])).toBe(false);
    expect(runnerTakesPlace('folder', ['session.folder'])).toBe(true);
  });
});

describe('runnerRefusal', () => {
  const online = (capabilities: Parameters<typeof runnerTakesPlace>[1]) => ({
    probedTools: beforeGrok,
    capabilities,
  });

  it('refuses an agent the runner was built without, online or not', () => {
    const launch = { agent: 'grok', place: 'worktree' as const };
    expect(runnerRefusal(launch, online([]))?.code).toBe('SESSIONS_011');
    expect(runnerRefusal(launch, { probedTools: beforeGrok, capabilities: null })?.code).toBe(
      'SESSIONS_011',
    );
  });

  it('refuses a folder session on a live runner that did not name session.folder', () => {
    const launch = { agent: 'shell', place: 'folder' as const };
    expect(runnerRefusal(launch, online(['session.image']))?.code).toBe('SESSIONS_025');
    expect(runnerRefusal(launch, online(['session.folder']))).toBeNull();
  });

  it('does not ask an offline host about the place: the dispatch checks again at hello', () => {
    const launch = { agent: 'shell', place: 'folder' as const };
    expect(runnerRefusal(launch, { probedTools: null, capabilities: null })).toBeNull();
  });

  it('asks the agent first, so an old runner is told about the agent it lacks', () => {
    const launch = { agent: 'grok', place: 'folder' as const };
    expect(runnerRefusal(launch, online(['session.image']))?.code).toBe('SESSIONS_011');
  });
});
