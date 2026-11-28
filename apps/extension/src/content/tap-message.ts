/** What the page tap hands the service worker: one `/sessions` response claude.ai fetched, or a session's events. */
export interface TapMessage {
  type: 'tap';
  url: string;
  /** Only `anthropic-*` and `x-organization-*` request headers. */
  headers: Record<string, string>;
  body: unknown;
}

/** The `postMessage` tag between `tap.ts` (the page) and `bridge.ts` (the extension). */
export const TAP_SOURCE = 'oppenheimer-claude-sessions';

/** The worker asking a claude.ai tab's bridge to post a reply (`bridge.ts`). */
export const CLAUDE_POST = 'claude-post';

export interface ClaudePostMessage {
  type: typeof CLAUDE_POST;
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

/** The bridge's answer: claude.ai's status, or why there was none. */
export type ClaudePostAnswer = { status: number } | { error: string };
