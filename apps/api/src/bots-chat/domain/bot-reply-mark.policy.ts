/**
 * What a contact turn's reply may open with, to say how it goes rather than
 * what it says: `[voice]` to be heard (`core/turn-context.contact-voice-reply`),
 * `[silent]` to keep out of a group line that was not for the bot
 * (`core/turn-context.contact-group-who`). Neither is ever sent.
 */
export const VOICE_REPLY_MARK = '[voice]';
export const SILENT_REPLY_MARK = '[silent]';

/** A contact turn's reply with its leading marks taken off. */
export interface PeeledReply {
  voice: boolean;
  silent: boolean;
  /** The words after the marks, trimmed; the reply as written when it has none. */
  text: string;
}

const MARKS: readonly { key: 'voice' | 'silent'; mark: string }[] = [
  { key: 'voice', mark: VOICE_REPLY_MARK },
  { key: 'silent', mark: SILENT_REPLY_MARK },
];

/**
 * The one reading of a reply's marks: every mark it opens with, in any order
 * and any case, each taken off. A mark further in is words, not a mark.
 */
export function peelReplyMarks(reply: string): PeeledReply {
  const peeled = { voice: false, silent: false };
  let rest = reply.trimStart();
  for (let found = true; found; ) {
    found = false;
    for (const { key, mark } of MARKS) {
      if (!rest.toLowerCase().startsWith(mark)) continue;
      peeled[key] = true;
      rest = rest.slice(mark.length).trimStart();
      found = true;
    }
  }
  return { ...peeled, text: peeled.voice || peeled.silent ? rest.trim() : reply };
}
