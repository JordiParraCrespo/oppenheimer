import { describe, expect, it } from 'vitest';
import {
  repositoryNameOf,
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
    folderPath?: string;
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
    overrides.folderPath ? 'folder' : 'worktree',
    overrides.folderPath ?? null,
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

describe('SessionEntity.isResolved', () => {
  it('is true only once the host has closed the session', () => {
    expect(session({ lifecycle: 'resolved' }).isResolved).toBe(true);
    expect(session({ lifecycle: 'open' }).isResolved).toBe(false);
    expect(session({ lifecycle: 'failed' }).isResolved).toBe(false);
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

  /** A folder session has no checkout to name; its folder is the scope. */
  it('reads the status line off the folder of a folder session', () => {
    const work = session({ folderPath: '/home/jordi/code/atlas' });

    expect(work.isFolder).toBe(true);
    expect(work.scopeLabel).toBe('/home/jordi/code/atlas');
    expect(work.inProject('project-2').folderPath).toBe('/home/jordi/code/atlas');
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

/**
 * A cloud session has no host or terminal: the console keeps asking about it
 * while its vendor's run works, and names its repository and the vendor's
 * branch where a host session names its checkout.
 */
describe('a cloud session', () => {
  function cloud(status: 'starting' | 'running' | 'finished', branch: string | null = null) {
    return new SessionEntity(
      'session-2',
      'org-1',
      'project-1',
      null,
      'Fix the login redirect loop',
      'calm-heron-2b8c1d',
      'cursor',
      { model: null, permission: null, effort: null },
      'working',
      'open',
      null,
      [],
      null,
      [],
      new Date('2026-10-27T12:00:00Z'),
      'cloud',
      null,
      null,
      null,
      null,
      null,
      0,
      null,
      {
        provider: 'cursor',
        url: 'https://cursor.com/agents?id=bc-session-2',
        repositoryUrl: 'https://github.com/acme/api',
        status,
        branch,
        pullRequestUrl: null,
        syncedAt: new Date('2026-10-27T12:00:00Z'),
      },
    );
  }

  it('is worked on while its vendor’s run is starting or running, and settled once it ended', () => {
    expect(cloud('starting').isCloudWorking).toBe(true);
    expect(cloud('running').isCloudWorking).toBe(true);
    expect(cloud('finished').isCloudWorking).toBe(false);
    expect(session().isCloudWorking).toBe(false);
  });

  it('names its repository, and the vendor’s branch once it pushed one', () => {
    expect(cloud('running').scopeLabel).toBe('acme/api');
    expect(cloud('finished', 'cursor/fix-login').scopeLabel).toBe('acme/api · cursor/fix-login');
  });

  it('names a GitHub repository by owner and name, and leaves any other URL whole', () => {
    expect(repositoryNameOf('https://github.com/acme/web.git')).toBe('acme/web');
    expect(repositoryNameOf('https://gitlab.com/acme/api')).toBe('https://gitlab.com/acme/api');
  });
});
