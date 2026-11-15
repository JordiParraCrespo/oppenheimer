/**
 * What an owner link means for someone without the Telegram app. A
 * `t.me/<bot>?start=<code>` link only sends `/start <code>` when the app
 * opens it; on Telegram Web the code is lost and the bot sees a plain
 * `/start`, a stranger's. So the console also offers the message itself, to
 * paste in the bot's chat, and that chat on Telegram Web.
 */
export function ownerLinkByHand(url: string): { message: string; webUrl: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const username = parsed.pathname.replace(/^\//, '');
  const code = parsed.searchParams.get('start');
  if (!username || !code) return null;
  return {
    message: `/start ${code}`,
    webUrl: `https://web.telegram.org/k/#@${encodeURIComponent(username)}`,
  };
}
