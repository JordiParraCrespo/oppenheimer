// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readPromptSuggestion, type ScreenRow } from '../prompt-suggestion';

const RULE = '─'.repeat(60);

/** A row drawn at full strength. */
const plain = (text: string): ScreenRow => ({ text, faint: [...text].map(() => false) });

/**
 * The input box's row: the prompt at full strength, then `text` with the
 * cursor's cell first and every other cell faint or not.
 */
function box(prompt: string, text: string, faint: boolean): ScreenRow {
  return {
    text: prompt + text,
    faint: [...Array(prompt.length).fill(false), ...Array.from(text, (_, i) => i > 0 && faint)],
  };
}

/** Claude Code 2.1's foot after a turn: the reply, the turn's line, the box between its rules. */
function screen(input: ScreenRow): ScreenRow[] {
  return [
    plain('  where the land meets the sea.'),
    plain(''),
    plain('✻ Baked for 14s · done 7:45 AM'),
    plain(''),
    plain(RULE),
    input,
    plain(RULE),
    plain('  ⏸ manual mode on · ? for shortcuts'),
  ];
}

describe('readPromptSuggestion', () => {
  it('reads the next message Claude Code predicts, drawn faint in its empty box, so the chat can offer it', () => {
    expect(readPromptSuggestion(screen(box('❯ ', 'save it to a file', true)))).toBe(
      'save it to a file',
    );
  });

  it('never offers what the person typed into the box, which is drawn at full strength', () => {
    expect(readPromptSuggestion(screen(box('❯ ', 'save it to a file', false)))).toBeNull();
  });

  // What breaks this: Claude Code's example prompt on a fresh session offered
  // as if it were a prediction, Tab putting `Try "…"` in the draft.
  it("never offers Claude Code's own placeholders, which Tab does not take", () => {
    expect(
      readPromptSuggestion(screen(box('❯\u00a0', 'Try "refactor <filepath>"', true))),
    ).toBeNull();
    expect(
      readPromptSuggestion(screen(box('❯\u00a0', 'Press up to edit queued messages', true))),
    ).toBeNull();
  });

  it('offers nothing while the box is empty', () => {
    expect(readPromptSuggestion(screen(box('❯ ', ' ', false)))).toBeNull();
  });

  it('reads only the box between its rules, not a faint line of the conversation above it', () => {
    const rows = screen(box('❯ ', ' ', false));
    rows[0] = box('❯ ', 'an earlier prompt', true);
    expect(readPromptSuggestion(rows)).toBeNull();
  });
});
