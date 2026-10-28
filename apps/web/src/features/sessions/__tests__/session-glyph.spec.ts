import { describe, expect, it } from 'vitest';
import { sessionGlyph } from '../lib/session-glyph';

/** The sidebar's mark per row (`product/versions/mvp/24-session-places.md` §5). */
describe('sessionGlyph', () => {
  it('draws the branch for a worktree session', () => {
    expect(sessionGlyph({ agent: 'claude-code', place: 'worktree', cloud: null })).toBe('branch');
  });

  it('draws a folder for a folder session', () => {
    expect(sessionGlyph({ agent: 'codex', place: 'folder', cloud: null })).toBe('folder');
  });

  it('draws a cloud for a session in Claude Code cloud', () => {
    expect(sessionGlyph({ agent: 'claude-code', place: 'cloud', cloud: null })).toBe('cloud');
  });

  it('draws the vendor’s mark for a session launched at its vendor, not the cloud', () => {
    const run = {
      provider: 'cursor' as const,
      url: null,
      repositoryUrl: 'https://github.com/acme/api',
      status: 'running' as const,
      branch: null,
      pullRequestUrl: null,
      syncedAt: new Date(),
    };
    expect(sessionGlyph({ agent: 'cursor', place: 'cloud', cloud: run })).toBe('vendor');
  });

  it('draws a terminal for the blank terminal, wherever it runs', () => {
    expect(sessionGlyph({ agent: 'shell', place: 'folder', cloud: null })).toBe('terminal');
    expect(sessionGlyph({ agent: 'shell', place: 'worktree', cloud: null })).toBe('terminal');
  });
});
