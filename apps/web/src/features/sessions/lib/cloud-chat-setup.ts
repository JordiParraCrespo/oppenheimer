/**
 * What a repository and a Claude Code cloud environment need for a cloud
 * session's chat to reach the console (`product/next-steps/cloud-agents.md`,
 * "The chat of a cloud session"), written out for the setup panel to copy.
 */

/** Where the repository keeps the hook the console hands out (`public/cloud-chat-hook.mjs`). */
export const CLOUD_CHAT_HOOK_PATH = '.claude/hooks/oppenheimer-cloud-chat.mjs';

/** The hook's address on this console, to download. */
export function cloudChatHookUrl(origin: string): string {
  return `${origin}/cloud-chat-hook.mjs`;
}

/**
 * The API the hook posts to: the configured one, or this console's origin,
 * which proxies `/api` when the two are served together.
 */
export function cloudChatApiUrl(configured: string | undefined, origin: string): string {
  return (configured || origin).replace(/\/+$/, '');
}

/** The lines for the repository's `.claude/settings.json`: both hooks, one file. */
export function cloudChatSettings(): string {
  const run = (mode: string, timeout: number) => ({
    hooks: [{ type: 'command', command: `node ${CLOUD_CHAT_HOOK_PATH} ${mode}`, timeout }],
  });
  return JSON.stringify(
    // The Stop hook waits up to two minutes for a reply, so it gets a little longer.
    { hooks: { SessionStart: [run('session-start', 10)], Stop: [run('stop', 150)] } },
    null,
    2,
  );
}

/** The cloud environment's variables: where the API is and the key. */
export function cloudChatEnvironment(apiUrl: string, key: string): string {
  return [
    `OPPENHEIMER_URL=${apiUrl}`,
    `OPPENHEIMER_CLOUD_KEY=${key}`,
    'OPPENHEIMER_REPLY_WAIT=120',
  ].join('\n');
}

/** The host to allow in the cloud environment's network access. */
export function cloudChatHost(apiUrl: string): string {
  return new URL(apiUrl).host;
}
