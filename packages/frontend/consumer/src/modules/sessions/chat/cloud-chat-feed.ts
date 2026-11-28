import {
  CLOUD_REPLY_PREAMBLE,
  type CloudChatSource as CloudChatOrigin,
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
   * host sent it with `claude -p … --cloud`, which wakes an idle session;
   * `browser`: the browser extension posted it on claude.ai as its author.
   * Null while it waits.
   */
  deliveredVia: CloudReplyDelivery | null;
}

/**
 * A reply the chat does not show yet, and why: `waiting` for the session's
 * Stop hook, or `sent` from a host or the browser extension and not yet back
 * in the transcript.
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
  /**
   * Where the lines come from: the session's hook, or its log on claude.ai
   * read by the browser extension. The two number the lines apart, so a
   * change means reading the chat again from its first line.
   */
  source: CloudChatOrigin;
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
/** How far claude.ai's clock may be behind the API's when a posted reply is matched by its words. */
const CLOCK_SKEW_MS = 60_000;

/**
 * A transcript line as the chat should read it. A reply reaches the agent as
 * the Stop hook's reason, which Claude Code keeps as a hidden "Stop hook
 * feedback" line; that line is the person's message, at the point the agent
 * took it, so it is read as one. Every other line is as it was written.
 */
function asChatLine(raw: string): {
  line: string;
  reply: string | null;
  prompt: TypedPrompt | null;
} {
  const unchanged = { line: raw, reply: null, prompt: null };
  let line: Record<string, unknown>;
  try {
    line = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return unchanged;
  }
  const message = line.message as { role?: unknown; content?: unknown } | undefined;
  const content = textOf(message?.content);
  if (
    line.type !== 'user' ||
    content === null ||
    (line.isMeta === true && !raw.includes(CLOUD_REPLY_PREAMBLE))
  ) {
    return unchanged;
  }
  const body = content.replace(FEEDBACK, '');
  const at = body.indexOf(CLOUD_REPLY_PREAMBLE);
  if (at < 0) {
    // A prompt as the person typed it: what a reply the extension posted on
    // claude.ai comes back as, under the reply's own id.
    const when = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : Number.NaN;
    return {
      ...unchanged,
      prompt: {
        id: typeof line.uuid === 'string' ? line.uuid : null,
        text: body.trim(),
        at: Number.isFinite(when) ? when : null,
      },
    };
  }
  const text = body.slice(at + CLOUD_REPLY_PREAMBLE.length).trim();
  return {
    line: JSON.stringify({ ...line, isMeta: false, message: { ...message, content: text } }),
    reply: text,
    prompt: null,
  };
}

/** A prompt the log holds, to find a reply the extension posted in it. */
interface TypedPrompt {
  id: string | null;
  text: string;
  /** When it was written, ms; null when the line does not say. */
  at: number | null;
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
  /** Where the lines read so far came from; null before the first read. */
  private origin: CloudChatOrigin | null = null;
  /** How many times each reply's words came back in the transcript. */
  private readonly echoed = new Map<string, number>();
  /** The prompts the log holds, for the replies the extension posted. */
  private prompts: TypedPrompt[] = [];
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
   * Whether a reply the extension posted is in the log: the prompt claude.ai
   * keeps under the reply's own id, or, where claude.ai gave it another id, a
   * prompt with its words written once it was claimed, each prompt counted
   * once. An earlier prompt with the same words ("continue") never is.
   */
  private posted(reply: CloudChatReply, used: Set<TypedPrompt>): boolean {
    const byId = this.prompts.find((prompt) => prompt.id === reply.id);
    if (byId) {
      used.add(byId);
      return true;
    }
    const claimed = reply.collectedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const byWords = this.prompts.find(
      (prompt) =>
        !used.has(prompt) &&
        prompt.text === reply.text &&
        prompt.at !== null &&
        prompt.at >= claimed - CLOCK_SKEW_MS,
    );
    if (byWords) used.add(byWords);
    return Boolean(byWords);
  }

  /**
   * A hook's reply is in the transcript the moment it is taken, since the hook
   * hands it over as the turn ends. A host's comes back only once the
   * session has run it, so it reads as sent until the transcript holds its
   * words, matched oldest first and each line once.
   */
  private pending(replies: readonly CloudChatReply[]): PendingCloudReply[] {
    const unmatched = new Map(this.echoed);
    const used = new Set<TypedPrompt>();
    const pending: PendingCloudReply[] = [];
    for (const reply of replies) {
      if (reply.collectedAt === null) {
        pending.push({ ...reply, state: 'waiting' });
        continue;
      }
      if (reply.deliveredVia === 'browser') {
        if (!this.posted(reply, used)) pending.push({ ...reply, state: 'sent' });
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
      if (this.origin !== null && page.source !== this.origin) {
        // The extension's lines replaced the hook's: numbered anew, so the
        // chat is read again from its first line, as if just opened.
        this.origin = page.source;
        this.next = 0;
        this.echoed.clear();
        this.prompts = [];
        return this.read(true);
      }
      this.origin = page.source;
      const read = page.lines.map(asChatLine);
      for (const { reply, prompt } of read) {
        if (prompt) this.prompts.push(prompt);
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
