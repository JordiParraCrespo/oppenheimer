import { describe, expect, it } from 'vitest';
import { SessionCheckoutEntity } from '../domain/session-checkout.entity';
import {
  checkoutDirectoryCandidates,
  checkoutDirectoryName,
  sessionBranchName,
} from '../domain/session-layout.policy';
import { mintSessionSlug, SESSION_SLUG_PATTERN } from '../domain/session-slug.policy';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import { WorkSessionEntity } from '../domain/work-session.entity';

/**
 * The aggregate's invariants, and the two naming rules that are functions of rows
 * rather than of the filesystem.
 */

let nextSeq = 0;
function entry(kind: string, payload: unknown = {}) {
  nextSeq += 1;
  return { seq: nextSeq, kind, payload, occurredAt: new Date(2026, 8, 19, 12, nextSeq) };
}

function session(overrides: Partial<Parameters<typeof WorkSessionEntity.request>[0]> = {}) {
  return WorkSessionEntity.request({
    organizationId: 'org-acme',
    projectId: 'project-1',
    createdByUserId: 'user-1',
    hostId: 'host-1',
    slug: 'bold-otter-3f9a7k',
    agent: 'claude-code',
    ...overrides,
  });
}

function checkout(work: WorkSessionEntity, directoryName: string, githubRepoId = '1') {
  return SessionCheckoutEntity.createNew({
    organizationId: work.organizationId,
    sessionId: work.id,
    installationId: 'installation-1',
    githubRepoId,
    repositoryFullName: `acme/${directoryName}`,
    directoryName,
    baseBranch: 'main',
    branch: sessionBranchName('xrp-mobile', work.slug),
  });
}

describe('a requested session', () => {
  it('starts with the slug as its name, and owes its host a job', () => {
    const work = session();
    expect(work.name).toBe('bold-otter-3f9a7k');
    expect(work.nameSource).toBeNull();
    expect(work.state).toBe('starting');
    expect(work.domainEvents).toHaveLength(1);
  });

  it('takes a name the caller typed, and marks it as a person’s', () => {
    const work = session({ name: 'Fix the wallet list' });
    expect(work.name).toBe('Fix the wallet list');
    expect(work.nameSource).toBe('user');
  });

  it('refuses a slug that is not a directory name', () => {
    // An invalid slug is not a display problem a client could work around: it is a
    // path and a git ref that cannot be created.
    expect(() => session({ slug: 'Not A Slug' })).toThrow();
  });
});

describe('recordEvent is the only mutator of the fold', () => {
  it('offers no way to set the state directly', () => {
    const work = session();
    expect((work as unknown as { setState?: unknown }).setState).toBeUndefined();
  });

  it('raises a state-changed event only on a real transition', () => {
    const work = session();
    work.clearEvents();

    work.recordEvent(entry(SESSION_EVENT_KINDS.REQUESTED));
    expect(work.domainEvents).toHaveLength(0);

    work.recordEvent(entry(SESSION_EVENT_KINDS.STARTED));
    expect(work.domainEvents).toHaveLength(1);

    // A second start is the same state: nothing changed, so nobody is owed a
    // notification.
    work.recordEvent(entry(SESSION_EVENT_KINDS.STARTED));
    expect(work.domainEvents).toHaveLength(1);
  });

  it('replays a log onto the aggregate exactly as the pure fold would', () => {
    const work = session();
    work.recordEvents([
      entry(SESSION_EVENT_KINDS.REQUESTED),
      entry(SESSION_EVENT_KINDS.STARTED, { agentSessionId: 'agent-3' }),
      entry(SESSION_EVENT_KINDS.STOPPED),
    ]);
    expect(work.state).toBe('open');
    expect(work.agentSessionId).toBe('agent-3');
    expect(work.stoppedAt).not.toBeNull();
  });

  it('says why it cannot take input: closed is final, stopped has no window', () => {
    const open = session();
    open.recordEvents([entry(SESSION_EVENT_KINDS.STARTED)]);
    expect(open.inputRefusal).toBeNull();

    const stopped = session();
    stopped.recordEvents([entry(SESSION_EVENT_KINDS.STARTED), entry(SESSION_EVENT_KINDS.STOPPED)]);
    expect(stopped.inputRefusal?.code).toBe('SESSIONS_014');

    const closed = session();
    closed.recordEvents([entry(SESSION_EVENT_KINDS.STARTED), entry(SESSION_EVENT_KINDS.CLOSED)]);
    expect(closed.inputRefusal?.code).toBe('SESSIONS_005');
  });

  it('reports a derived group, and a closed session reports resolved', () => {
    const work = session();
    work.recordEvents([entry(SESSION_EVENT_KINDS.STARTED), entry(SESSION_EVENT_KINDS.CLOSED)]);
    expect(work.group()).toBe('resolved');
    expect(work.isResolved).toBe(true);
  });
});

describe('the checkouts the aggregate holds', () => {
  it('takes its working directory from the log, not from a setter', () => {
    const work = session();
    const first = checkout(work, 'xrp-mobile', '1');
    work.attachCheckout(first);

    work.recordEvent(entry(SESSION_EVENT_KINDS.CWD_SET, { checkoutId: first.id }));
    expect(work.cwdCheckoutId).toBe(first.id);
    expect((work as unknown as { setCwdCheckout?: unknown }).setCwdCheckout).toBeUndefined();
  });

  it('steps the agent out of a checkout the log retires', () => {
    // The foreign key's `ON DELETE SET NULL` never fires, because checkout rows are
    // not deleted. Folding the event is what nulls the column and marks the child,
    // so a replay rebuilds both.
    const work = session();
    const first = checkout(work, 'xrp-mobile', '1');
    work.attachCheckout(first);
    work.recordEvent(entry(SESSION_EVENT_KINDS.CWD_SET, { checkoutId: first.id }));

    work.recordEvent(entry(SESSION_EVENT_KINDS.CHECKOUT_REMOVED, { checkoutId: first.id }));

    expect(work.cwdCheckoutId).toBeNull();
    expect(work.liveCheckouts).toHaveLength(0);
    // The row stays, which is what keeps the directory name out of circulation.
    expect(work.checkouts).toHaveLength(1);
    expect(work.usedDirectoryNames).toEqual(['xrp-mobile']);
  });

  it('leaves the agent where it is when another checkout is retired', () => {
    const work = session();
    const first = checkout(work, 'xrp-mobile', '1');
    const second = checkout(work, 'design-system', '2');
    work.attachCheckout(first);
    work.attachCheckout(second);
    work.recordEvent(entry(SESSION_EVENT_KINDS.CWD_SET, { checkoutId: first.id }));

    work.recordEvent(entry(SESSION_EVENT_KINDS.CHECKOUT_REMOVED, { checkoutId: second.id }));

    expect(work.cwdCheckoutId).toBe(first.id);
  });
});

describe('the two derived names', () => {
  it('builds a branch that carries both ids', () => {
    // Both segments are unique-constrained, so a branch name is self-identifying and
    // collision-free by construction — no pre-flight check against GitHub, no race.
    expect(sessionBranchName('xrp-mobile', 'bold-otter-3f9a7k')).toBe(
      'oppenheimer/xrp-mobile/bold-otter-3f9a7k',
    );
  });

  it('derives every directory candidate from the repository', () => {
    expect(checkoutDirectoryCandidates('acme/xrp-mobile', '821374923')).toEqual([
      'xrp-mobile',
      'acme--xrp-mobile',
      'acme--xrp-mobile-821374923',
    ]);
  });

  it('never reuses a directory name inside a session, retired ones included', () => {
    // The agents key their conversation state by working directory, so a new
    // checkout on a retired name would inherit a stranger's history.
    expect(checkoutDirectoryName('other/xrp-mobile', '99', ['xrp-mobile'])).toBe(
      'other--xrp-mobile',
    );
    expect(
      checkoutDirectoryName('other/xrp-mobile', '99', ['xrp-mobile', 'other--xrp-mobile']),
    ).toBe('other--xrp-mobile-99');
  });

  it('runs out rather than recycling the last candidate', () => {
    // A session that added, retired and re-added the same repository through all
    // three names has no name left. Reissuing one would put a fresh agent in a
    // retired agent's working directory, which is the whole bug the tombstone
    // exists to prevent, so the answer is `null` and the caller refuses.
    expect(
      checkoutDirectoryName('other/xrp-mobile', '99', [
        'xrp-mobile',
        'other--xrp-mobile',
        'other--xrp-mobile-99',
      ]),
    ).toBeNull();
  });
});

describe('the minted slug', () => {
  it('is <adjective>-<noun>-<6 base36>, every time', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(mintSessionSlug()).toMatch(SESSION_SLUG_PATTERN);
    }
  });

  it('does not repeat itself over a run of mints', () => {
    const minted = new Set(Array.from({ length: 500 }, () => mintSessionSlug()));
    expect(minted.size).toBeGreaterThan(495);
  });
});
