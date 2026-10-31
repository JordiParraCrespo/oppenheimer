import { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { act, render } from '@testing-library/react';
import { SessionChat } from '../../sections/session-chat';

/**
 * A Claude Code session's chat replayed from its own transcript, the way
 * Codex's TUI tests replay a recorded session into its chat widget: a
 * recording is the transcript's JSONL, line for line as the runner reads it
 * off the host and sends it (`SessionChat.apply`), so what is drawn comes
 * through the product package's parser and the console's renderers, never
 * from turns the spec built. A `{"type":"replay.mark","name":…}` line is the
 * replay's own, never sent: a point the spec plays to, then looks. The chat
 * opens on the lines before the first mark, sent as the host's reset.
 */
export function replaySessionChat(jsonl: string, { readOnly = false } = {}) {
  const chunks: { mark: string | null; entries: string[] }[] = [{ mark: null, entries: [] }];
  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = JSON.parse(line) as { type?: string; name?: string };
    if (parsed.type === 'replay.mark') chunks.push({ mark: parsed.name ?? '', entries: [] });
    else chunks.at(-1)?.entries.push(line);
  }

  const chat = new Chat();
  const typed: string[] = [];
  chat.connect((data) => typed.push(data));
  // What the host had when the chat attached: the first batch, as a reset.
  const [opening, ...rest] = chunks;
  chat.apply({ reset: true, entries: opening?.entries ?? [] });
  const view = render(<SessionChat chat={chat} readOnly={readOnly} />);
  let next = 0;

  /** Sends each stretch of lines between marks as one batch, until the chat stands at `mark`. */
  const playTo = (mark: string | null) => {
    while (next < rest.length) {
      const chunk = rest[next] as (typeof rest)[number];
      if (chunk.mark === mark) return;
      act(() => chat.apply({ entries: chunk.entries }));
      next += 1;
    }
    if (mark !== null) throw new Error(`no mark "${mark}" in the recording`);
  };

  return {
    ...view,
    chat,
    /** What the chat typed into the session's terminal. */
    typed,
    /** Plays every line before `mark`; the chat opens standing at the recording's first. */
    playTo: (mark: string) => playTo(mark),
    playAll() {
      playTo(null);
    },
  };
}
