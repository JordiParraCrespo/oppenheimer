/** What the page tap hands the service worker: one `/sessions` response claude.ai fetched. */
export interface TapMessage {
  type: 'tap';
  url: string;
  /** Only `anthropic-*` and `x-organization-*` request headers. */
  headers: Record<string, string>;
  body: unknown;
}

/** The `postMessage` tag between `tap.ts` (the page) and `bridge.ts` (the extension). */
export const TAP_SOURCE = 'oppenheimer-claude-sessions';
