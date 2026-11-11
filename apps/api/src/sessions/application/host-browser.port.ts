import type { BrowserActMessage, BrowserPageMessage } from '@oppenheimer/shared/protocol';

/** What to do in a bot's browser on a host: `browser.act` without its envelope. */
export type HostBrowserRequest = Omit<BrowserActMessage, 'type' | 'commandId'>;

/** The page afterwards: `browser.page` without its envelope. */
export type HostBrowserPage = Omit<BrowserPageMessage, 'type' | 'commandId'>;

/**
 * What asking a host to act in a bot's browser came back with: the page, the
 * reason nothing was asked (no link, or a runner that drives no browser), no
 * answer in time, or the host's refusal with its catalog code (`BROWSER_001`
 * it is off there, `BROWSER_002` no browser is installed, `BROWSER_003` the
 * action does not fit, `BROWSER_004` the browser or the page failed,
 * `BROWSER_005` its setting cannot be read).
 */
export type HostBrowserOutcome =
  | { kind: 'page'; page: HostBrowserPage }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so a bot can drive a
 * browser of its own on a host (`product/versions/mvp/25-bots.md` §4.2,
 * "Using a browser"). It waits for the runner's answer; whether the host
 * lets bots browse from it at all is the host's own setting, which nothing
 * here sees. The page and its picture are never stored.
 */
export interface HostBrowserPort {
  /**
   * Do `request` on the host. `commandId`, when given, names the action
   * across retries: a runner that already did it answers with the page it
   * left instead of doing it again.
   */
  act(hostId: string, request: HostBrowserRequest, commandId?: string): Promise<HostBrowserOutcome>;
}
