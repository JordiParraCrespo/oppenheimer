/**
 * How long a composed line waits before its Enter. An agent's input box
 * (Claude Code, Codex) reads one write that holds text and a carriage return
 * as a paste, and keeps the newline in the draft instead of submitting it;
 * typed keys arrive as separate writes. Two writes this far apart read as
 * typing on a local link and over the relay alike.
 */
export const SUBMIT_AFTER_MS = 40;

/** Sends a line to an agent's prompt as if typed and submitted: the text, then Enter on its own write. */
export function submitLine(
  send: (data: string) => void,
  text: string,
  later: (run: () => void, ms: number) => unknown = setTimeout,
): void {
  send(text);
  later(() => send('\r'), SUBMIT_AFTER_MS);
}
