import { describe, expect, it } from 'vitest';
import { sessionGlyph } from '../lib/session-glyph';

/** The sidebar's mark per row (`product/versions/mvp/24-session-places.md` §5). */
describe('sessionGlyph', () => {
  it('draws the branch for a worktree session', () => {
    expect(sessionGlyph({ agent: 'claude-code', place: 'worktree' })).toBe('branch');
  });

  it('draws a folder for a folder session', () => {
    expect(sessionGlyph({ agent: 'codex', place: 'folder' })).toBe('folder');
  });

  it('draws a cloud for a session in Claude Code cloud', () => {
    expect(sessionGlyph({ agent: 'claude-code', place: 'cloud' })).toBe('cloud');
  });

  it('draws a terminal for the blank terminal, wherever it runs', () => {
    expect(sessionGlyph({ agent: 'shell', place: 'folder' })).toBe('terminal');
    expect(sessionGlyph({ agent: 'shell', place: 'worktree' })).toBe('terminal');
  });
});
