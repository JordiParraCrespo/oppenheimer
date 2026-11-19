/**
 * A message typed into the agent's prompt that its transcript has not shown
 * yet: the agent writes the prompt down only once it takes it, and the host
 * sends the line on after, so the chat draws it until then.
 */
export interface ChatSending {
  id: string;
  text: string;
}

/** What the matching reads of a turn: its id, and the prompt that opened it. */
interface PromptedTurn {
  id: string;
  prompt: { id: string; text: string } | null;
}

/**
 * How long a sent message is drawn while its prompt has not come back in
 * the transcript: one the agent never writes down (a keystroke its picker
 * took, a command it answers out of the transcript) must not stay forever.
 */
const SENDING_FOR_MS = 30_000;

/**
 * Which sent messages a conversation's prompts have replaced. Each message
 * looks only at the turns after the one that was last when it went (`after`),
 * for a prompt that says its words, however the transcript spaces them; the
 * oldest message takes the first such prompt, and a prompt in `matched`, or
 * taken earlier in this call, takes none. Pure: the caller keeps what was
 * taken.
 */
export function matchSent(
  sending: readonly ChatSending[],
  after: (id: string) => string | null,
  turns: readonly PromptedTurn[],
  matched: ReadonlySet<string>,
): { left: ChatSending[]; taken: Map<string, string> } {
  const taken = new Map<string, string>();
  const used = (prompt: string) => matched.has(prompt) || [...taken.values()].includes(prompt);
  const left = sending.filter((held) => {
    const anchor = after(held.id);
    const start = anchor ? turns.findIndex((turn) => turn.id === anchor) + 1 : 0;
    const words = unspaced(held.text);
    const prompt = turns
      .slice(start)
      .find(
        (turn) =>
          turn.prompt !== null &&
          !used(turn.prompt.id) &&
          unspaced(turn.prompt.text).includes(words),
      )?.prompt;
    if (!prompt) return true;
    taken.set(held.id, prompt.id);
    return false;
  });
  return { left, taken };
}

/**
 * The messages on their way, for `SessionChat`: when each went and the timer
 * that lets it go, and the prompts that have replaced one, held while any
 * other is still on its way so a later batch never hands one of them to a
 * second message that says the same.
 */
export class SentMessages {
  private readonly anchors = new Map<
    string,
    { after: string | null; timer: ReturnType<typeof setTimeout> }
  >();
  private readonly matched = new Set<string>();
  private ids = 0;

  /** `expire` lets go of a message whose prompt has not come in `SENDING_FOR_MS`. */
  constructor(private readonly expire: (id: string) => void) {}

  /** A message just typed, after the turn `after` (none when the chat has no turn yet). */
  start(text: string, after: string | null): ChatSending {
    this.ids += 1;
    const id = `sending-${this.ids}`;
    const timer = setTimeout(() => {
      if (this.anchors.delete(id)) this.expire(id);
    }, SENDING_FOR_MS);
    this.anchors.set(id, { after, timer });
    return { id, text };
  }

  /** What of `sending` is still on its way once `turns` are in; the same array when none landed. */
  landed(sending: readonly ChatSending[], turns: readonly PromptedTurn[]): readonly ChatSending[] {
    if (sending.length === 0) {
      this.matched.clear();
      return sending;
    }
    const { left, taken } = matchSent(
      sending,
      (id) => this.anchors.get(id)?.after ?? null,
      turns,
      this.matched,
    );
    for (const [id, prompt] of taken) {
      clearTimeout(this.anchors.get(id)?.timer);
      this.anchors.delete(id);
      this.matched.add(prompt);
    }
    if (left.length === 0) this.matched.clear();
    return taken.size === 0 ? sending : left;
  }

  /** Lets every message go, its timer with it: the pane that sent them is gone. */
  drop(): void {
    for (const { timer } of this.anchors.values()) clearTimeout(timer);
    this.anchors.clear();
    this.matched.clear();
  }
}

/**
 * A message's words with no spacing, to know it in its prompt: the
 * transcript writes some the way the CLI read them, not as typed (`!ls`
 * comes back as `! ls`, a command's arguments with one space).
 */
function unspaced(text: string): string {
  return text.replace(/\s+/g, '');
}
