import { describe, expect, it } from 'vitest';
import {
  SessionCheckoutEntity,
  SessionEntity,
  type SessionGroup,
  type SessionState,
} from '../session.entity';

function checkout(githubRepoId: string, fullName: string, branch: string) {
  return new SessionCheckoutEntity(
    `checkout-${githubRepoId}`,
    'installation-1',
    githubRepoId,
    fullName,
    fullName.split('/')[1] ?? fullName,
    'main',
    branch,
  );
}

function session(
  overrides: {
    lifecycle?: SessionState;
    state?: SessionGroup;
    stoppedAt?: Date | null;
    checkouts?: SessionCheckoutEntity[];
    cwdCheckoutId?: string | null;
    hints?: string[];
  } = {},
): SessionEntity {
  return new SessionEntity(
    'session-1',
    'org-1',
    'project-1',
    'host-1',
    'Fix the wallet list empty state',
    'bold-otter-3f9a7k',
    'claude-code',
    { model: 'opus', permission: 'ask', effort: null },
    overrides.state ?? 'working',
    overrides.lifecycle ?? 'open',
    overrides.cwdCheckoutId ?? null,
    overrides.checkouts ?? [],
    overrides.stoppedAt ?? null,
    overrides.hints ?? [],
    new Date('2026-06-15T12:00:00Z'),
  );
}

/**
 * The terminal attaches only to a session whose tmux is still there, and that is
 * the **lifecycle**'s answer rather than the group's: the group is organised by
 * what needs you, so `idle` and `waiting-on-you` are both sessions with a live
 * PTY behind them.
 */
describe('SessionEntity.isLive', () => {
  it('is true for a session the host has built and not ended', () => {
    expect(session({ lifecycle: 'open' }).isLive).toBe(true);
    expect(session({ lifecycle: 'open', state: 'idle' }).isLive).toBe(true);
    expect(session({ lifecycle: 'open', state: 'waiting-on-you' }).isLive).toBe(true);
  });

  it('is false before the worktree exists and after the agent is gone', () => {
    expect(session({ lifecycle: 'starting' }).isLive).toBe(false);
    expect(session({ lifecycle: 'failed' }).isLive).toBe(false);
    expect(session({ lifecycle: 'resolved' }).isLive).toBe(false);
    // Stopping does not move the lifecycle — the worktrees are still on disk —
    // so `stoppedAt` is the only thing that says the PTY is gone.
    expect(session({ lifecycle: 'open', stoppedAt: new Date() }).isLive).toBe(false);
  });
});

describe('SessionEntity.isProvisioning', () => {
  it('is true only while the host has not picked the session up', () => {
    expect(session({ lifecycle: 'starting' }).isProvisioning).toBe(true);
    expect(session({ lifecycle: 'open' }).isProvisioning).toBe(false);
    expect(session({ lifecycle: 'failed' }).isProvisioning).toBe(false);
  });
});

describe('the checkouts a session carries', () => {
  const mobile = checkout('42', 'acme/xrp-mobile', 'oppenheimer/xrp/bold-otter-3f9a7k');
  const web = checkout('43', 'acme/xrp-web', 'oppenheimer/xrp/bold-otter-3f9a7k');

  it('reads the status line off the checkout the agent was launched in', () => {
    const work = session({ checkouts: [mobile, web], cwdCheckoutId: web.id });

    expect(work.cwdCheckout).toBe(web);
    expect(work.scopeLabel).toBe('xrp-web · oppenheimer/xrp/bold-otter-3f9a7k +1');
  });

  it('falls back to the first checkout when the agent runs in none of them', () => {
    // A null cwd is a real session: the agent starts in the session directory
    // with every checkout a peer, and the first is what the session was for.
    const work = session({ checkouts: [mobile, web], cwdCheckoutId: null });

    expect(work.cwdCheckout).toBe(mobile);
    expect(work.scopeLabel).toBe('xrp-mobile · oppenheimer/xrp/bold-otter-3f9a7k +1');
  });

  it('counts nothing extra for a single checkout', () => {
    expect(session({ checkouts: [mobile] }).scopeLabel).toBe(
      'xrp-mobile · oppenheimer/xrp/bold-otter-3f9a7k',
    );
  });

  it('has no status line at all for a session with no git', () => {
    const work = session({ checkouts: [] });

    expect(work.cwdCheckout).toBeUndefined();
    expect(work.scopeLabel).toBeNull();
  });
});

/**
 * `host_offline` is what the control plane says when a command was recorded but
 * no link to the host exists — so the work is owed rather than done. It is the
 * one hint the console has a use for.
 */
describe('SessionEntity.isHostOffline', () => {
  it('reads the hint the create request came back with', () => {
    expect(session({ hints: ['host_offline'] }).isHostOffline).toBe(true);
    expect(session({ hints: [] }).isHostOffline).toBe(false);
  });
});
