import { CLOUD_REPLY_PREAMBLE } from '@oppenheimer/shared/schemas/session-cloud-chat';
import type { SessionChat } from './session-chat';

/** A reply typed in a cloud session's chat, and whether the agent has taken it. */
export interface CloudChatReply {
  id: string;
  text: string;
  createdAt: Date;
  /** When the session's Stop hook took it to the agent; null while it waits. */
  collectedAt: Date | null;
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
  read(after: number): Promise<CloudChatPage>;
  reply(text: string): Promise<void>;
}

const PASTE = /\u001b\[20[01]~/g;
const ESCAPE = '\u001b';
const ENTER = '\r';
const FEEDBACK = /^Stop hook feedback:\n(?:\[[^\]]*\]: )?/;

/**
 * A transcript line as the chat should read it. A reply reaches the agent as
 * the Stop hook's reason, which Claude Code keeps as a hidden "Stop hook
 * feedback" line; that line is the person's message, at the point the agent
 * took it, so it is read as one. Every other line is as it was written.
 */
export function asChatLine(raw: string): string {
  if (!raw.includes(CLOUD_REPLY_PREAMBLE)) return raw;
  let line: Record<string, unknown>;
  try {
    line = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }
  const message = line.message as { role?: unknown; content?: unknown } | undefined;
  if (line.type !== 'user' || typeof message?.content !== 'string') return raw;
  const body = message.content.replace(FEEDBACK, '');
  const at = body.indexOf(CLOUD_REPLY_PREAMBLE);
  if (at < 0) return raw;
  const text = body.slice(at + CLOUD_REPLY_PREAMBLE.length).trim();
  return JSON.stringify({ ...line, isMeta: false, message: { ...message, content: text } });
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
  private typed = '';
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly source: CloudChatSource,
    private readonly chat: SessionChat,
    private readonly options: {
      everyMs: number;
      /** The replies the agent has not taken yet, after every read. */
      onWaiting: (waiting: readonly CloudChatReply[]) => void;
      /** A reply that did not reach the API, and why; the chat draws it. */
      onReplyFailed: (error: unknown) => void;
    },
  ) {}

  /** Starts reading and lends the chat its typing; the function returned stops both. */
  start(): () => void {
    const release = this.chat.connect((data) => this.type(data));
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
      this.typed += data.replace(PASTE, '');
      return;
    }
    const text = this.typed.trim();
    this.typed = '';
    // The next read, on its tick, lists it as waiting: one read at a time.
    if (text) this.source.reply(text).catch(this.options.onReplyFailed);
  }

  private async read(first: boolean): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    try {
      const page = await this.source.read(this.next);
      if (this.stopped) return;
      if (first || page.lines.length > 0) {
        this.chat.apply({
          reset: first,
          history: first ? 'end' : undefined,
          entries: page.lines.map(asChatLine),
        });
      }
      this.next = page.next;
      this.options.onWaiting(page.replies.filter((reply) => reply.collectedAt === null));
    } catch {
      // A failed read is tried again on the next tick; the chat keeps what it drew.
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.read(false), this.options.everyMs);
  }
}
