// @vitest-environment node
import { SessionEntity, type SessionGroup } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { attentionFor, rowAttentionFor, rowGlyphFor } from '../lib/session-run-state';

/**
 * A session's sidebar row speaks the bots' dots: amber while it waits on the
 * reader, blue once it is ready for review, nothing while it works (its name
 * shimmers). The glyph stays grey for those, so a waiting row is no longer
 * a red branch, and only the lifecycle (building, deleting, a refused
 * delete) still moves it.
 */
function session(
  state: SessionGroup,
  extra: Partial<ConstructorParameters<typeof SessionEntity>[0]> = {},
) {
  return new SessionEntity({
    id: 's-1',
    organizationId: 'org-1',
    projectId: 'p-1',
    hostId: 'h-1',
    name: 'Fix the list',
    slug: 'bold-otter',
    agent: 'claude-code',
    launch: { model: null, permission: null, effort: null },
    state,
    lifecycle: 'open',
    cwdCheckoutId: null,
    checkouts: [],
    stoppedAt: null,
    hints: [],
    createdAt: new Date('2026-10-01T00:00:00Z'),
    place: 'worktree',
    folderPath: null,
    agentReport: null,
    ...extra,
  });
}

describe('a session row’s dot', () => {
  it('is amber while the session waits on the reader, blue once it is ready for review', () => {
    expect(attentionFor(session('waiting-on-you'))).toBe('needs-you');
    expect(attentionFor(session('ready-for-review'))).toBe('done');
  });

  it('is absent while the agent works and when nothing waits', () => {
    for (const state of ['working', 'idle', 'landing', 'resolved'] as const) {
      expect(attentionFor(session(state))).toBeUndefined();
    }
  });

  it('leaves the glyph grey for a waiting or working session, where it was red and green', () => {
    expect(rowGlyphFor(session('waiting-on-you'))).toBe('idle');
    expect(rowGlyphFor(session('working'))).toBe('idle');
    expect(rowGlyphFor(session('ready-for-review'))).toBe('idle');
  });
});

describe('rowAttentionFor', () => {
  it('draws the reader’s unread mark only where the session needs nothing from them', () => {
    expect(rowAttentionFor(session('idle'), true)).toBe('unread');
    expect(rowAttentionFor(session('waiting-on-you'), true)).toBe('needs-you');
    expect(rowAttentionFor(session('idle'), false)).toBeUndefined();
  });
});
