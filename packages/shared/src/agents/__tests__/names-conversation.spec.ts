import { describe, expect, it } from 'vitest';
import { codingAgentNamesConversation } from '../catalog';

/**
 * Which agents can run twice in one worktree: only one whose CLI takes the id
 * of the conversation it starts, since the runner finds the others by the
 * folder. The regression: the side pane offering a second Codex, whose
 * conversation the session's chat and restart would then follow.
 */
describe('codingAgentNamesConversation', () => {
  it('is true for Claude Code and false for Codex, which is found by its folder', () => {
    expect(codingAgentNamesConversation('claude-code')).toBe(true);
    expect(codingAgentNamesConversation('codex')).toBe(false);
  });
});
