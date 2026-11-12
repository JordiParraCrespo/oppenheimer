import {
  CLOUD_REPLY_PREAMBLE,
  type CloudReplyDelivery,
} from '@oppenheimer/shared/schemas/session-cloud-chat';
import type { SessionChat } from './session-chat';

/** A reply typed in a cloud session's chat, and whether the agent has taken it. */
export interface CloudChatReply {
  id: string;
  text: string;
  createdAt: Date;
  /** When it reached the agent, by either way; null while it waits. */
  collectedAt: Date | null;
  /**
   * `hook`: the session's Stop hook took it at the end of a turn; `host`: a
   * host sent it with `claude -p … --cloud`, which wakes an idle session.
   * Null while it waits.
   */
  deliveredVia: CloudReplyDelivery | null;
}

/**
 * A reply the chat does not show yet, and why: `waiting` for the session's
 * Stop hook, or `sent` from a host and not yet back in the transcript.
 */
export interface PendingCloudReply extends CloudChatReply {
  state: 'waiting' | 'sent';
}

/** What one read of a cloud session's chat answers. */
export interface CloudChatPage {
  /** Transcript lines from where the read started, as Claude Code wrote them. */
  lines: readonly string[];
  /** Where the next read starts. */
  next: number;
  replies: readonly CloudChatReply[];
}

/** Where a feed reads a cloud session's chat and sends replies: the API, through the repository. */
export interface CloudChatSource {
  read(from: number): Promise<CloudChatPage>;
  reply(text: string): Promise<void>;
}

/** The marks a paste is typed between, which a reply leaves out. */
const PASTE_MARKS = ['\u001b[200~', '\u001b[201~'];
const ESCAPE = '\u001b';
const ENTER = '\r';
const FEEDBACK = /^Stop hook feedback:\n(?:\[[^\]]*\]: )?/;

/**
 * A transcript line as the chat should read it. A reply reaches the agent as
 * the Stop hook's reason, which Claude Code keeps as a hidden "Stop hook
 * feedback" line; that line is the person's message, at the point the agent
 * took it, so it is read as one. Every other line is as it was written.
 */
function asChatLine(raw: string): { line: string; reply: string | null } {
  const unchanged = { line: raw, reply: null };
  if (!raw.includes(CLOUD_REPLY_PREAMBLE)) return unchanged;
  let line: Record<string, unknown>;
  try {
    line = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return unchanged;
  }
  const message = line.message as { role?: unknown; content?: unknown } | undefined;
  const content = textOf(message?.content);
  if (line.type !== 'user' || content === null) return unchanged;
  const body = content.replace(FEEDBACK, '');
  const at = body.indexOf(CLOUD_REPLY_PREAMBLE);
  if (at < 0) return unchanged;
  const text = body.slice(at + CLOUD_REPLY_PREAMBLE.length).trim();
  return {
    line: JSON.stringify({ ...line, isMeta: false, message: { ...message, content: text } }),
    reply: text,
  };
}

/**
 * A user line's words: a string, as the Stop hook's feedback is kept, or the
 * one text block of a prompt, as a message a host sent with `claude -p` may be.
 */
function textOf(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.length !== 1) return null;
  const [block] = content as { type?: unknown; text?: unknown }[];
  return block?.type === 'text' && typeof block.text === 'string' ? block.text : null;
}

/**
 * A Claude Code cloud session's chat, kept current from the API: it reads the
 * transcript lines its hook sent from where it stopped, every `everyMs` and
 * one read at a time, into
 * the same `SessionChat` a host session's terminal feeds, and hands the chat
 * a way to type that turns a message into a reply for the agent.
 *
 * The chat types the way a person types into a terminal (the words, then
 * Enter, a paste between bracket marks), so the typing is gathered until
 * Enter and sent as one reply. Escape would stop the agent in a terminal;
 * nothing here can, so it is dropped.
 */
export class CloudChatFeed {
  private next = 0;
  /** How many times each reply's words came back in the transcript. */
  private readonly echoed = new Map<string, number>();
  private typed = '';
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly source: CloudChatSource,
    private readonly chat: SessionChat,
    private readonly options: {
      everyMs: number;
      /**
       * After every read, the replies the chat does not show yet, oldest
       * first: those waiting for the Stop hook, and those a host sent that
       * have not come back in the transcript.
       */
      onPending: (pending: readonly PendingCloudReply[]) => void;
      /** A reply that did not reach the API, and why; the chat draws it. */
      onReplyFailed: (error: unknown) => void;
    },
  ) {}

  /** Starts reading and lends the chat its typing; the function returned stops both. */
  start(): () => void {
    const release = this.chat.connect((data) => this.type(data), undefined, {
      interruptible: false,
    });
    void this.read(true);
    return () => {
      this.stopped = true;
      if (this.timer) clearTimeout(this.timer);
      release();
    };
  }

  private type(data: string): void {
    if (data === ESCAPE) return;
    if (data !== ENTER) {
      this.typed += PASTE_MARKS.reduce((text, mark) => text.split(mark).join(''), data);
      return;
    }
    const text = this.typed.trim();
    this.typed = '';
    // The next read, on its tick, lists it as waiting: one read at a time.
    if (text) this.source.reply(text).catch(this.options.onReplyFailed);
  }

  /**
   * A hook's reply is in the transcript the moment it is taken, since the hook
   * hands it over as the turn ends. A host's comes back only once the
   * session has run it, so it reads as sent until the transcript holds its
   * words, matched oldest first and each line once.
   */
  private pending(replies: readonly CloudChatReply[]): PendingCloudReply[] {
    const unmatched = new Map(this.echoed);
    const pending: PendingCloudReply[] = [];
    for (const reply of replies) {
      if (reply.collectedAt === null) {
        pending.push({ ...reply, state: 'waiting' });
        continue;
      }
      const seen = unmatched.get(reply.text) ?? 0;
      if (seen > 0) unmatched.set(reply.text, seen - 1);
      else if (reply.deliveredVia === 'host') pending.push({ ...reply, state: 'sent' });
    }
    return pending;
  }

  private async read(first: boolean): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    try {
      const page = await this.source.read(this.next);
      if (this.stopped) return;
      const read = page.lines.map(asChatLine);
      for (const { reply } of read) {
        if (reply !== null) this.echoed.set(reply, (this.echoed.get(reply) ?? 0) + 1);
      }
      if (first || read.length > 0) {
        this.chat.apply({
          reset: first,
          history: first ? 'end' : undefined,
          entries: read.map((each) => each.line),
        });
      }
      this.next = page.next;
      this.options.onPending(this.pending(page.replies));
    } catch {
      // A failed read is tried again on the next tick; the chat keeps what it drew.
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.read(false), this.options.everyMs);
  }
}
