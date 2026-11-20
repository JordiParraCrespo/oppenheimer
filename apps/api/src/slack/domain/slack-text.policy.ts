/** Slack's advice for one message's text: past this a long answer goes in several. */
export const SLACK_MESSAGE_MAX = 3_900;

/**
 * The bot's markdown in Slack's own (`mrkdwn`): `&`, `<` and `>` escaped,
 * `**bold**` as `*bold*`, a heading as a bold line, `[label](url)` as Slack's
 * `<url|label>`, and `~~gone~~` as `~gone~`. Code spans and blocks keep their
 * backticks, which Slack reads the same way.
 */
export function slackMrkdwn(markdown: string): string {
  return markdown
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/^#{1,6}\s+(.+?)\s*#*$/gm, '*$1*')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/~~(.+?)~~/g, '~$1~')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<$2|$1>');
}

/**
 * A text in the messages Slack takes, each at most `SLACK_MESSAGE_MAX`: cut at
 * the last blank line, else the last line, else a space, before the limit.
 */
export function slackMessages(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > SLACK_MESSAGE_MAX) {
    const window = rest.slice(0, SLACK_MESSAGE_MAX);
    const cut = [
      window.lastIndexOf('\n\n'),
      window.lastIndexOf('\n'),
      window.lastIndexOf(' '),
    ].find((at) => at > SLACK_MESSAGE_MAX / 2);
    const at = cut ?? SLACK_MESSAGE_MAX;
    parts.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Where a conversation's answer goes: its chat id is the channel and the thread, `<channel>:<thread ts>`. */
export function slackThreadOf(chatId: string): { channel: string; threadTs: string } | null {
  const match = /^([A-Z0-9]{1,32}):(\d{1,12}\.\d{6})$/.exec(chatId);
  return match ? { channel: match[1], threadTs: match[2] } : null;
}

/** A conversation's chat id: the channel and the thread the answer goes in. */
export function slackChatIdOf(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}
