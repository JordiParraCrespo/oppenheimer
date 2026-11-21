import type { HostBrowserRequest } from '../sessions/application/host-browser.port';
import { type BrowserCall, browserCallFields } from './application/bot-browser.policy';

/** A `use_browser` field as the link's `browser.act` names it. */
const ON_THE_LINK = {
  url: 'url',
  ref: 'ref',
  x: 'x',
  y: 'y',
  scroll_y: 'scrollY',
  text: 'text',
  keys: 'keys',
  seconds: 'seconds',
} as const satisfies Record<keyof Omit<BrowserCall, 'action'>, keyof HostBrowserRequest>;

/**
 * A `use_browser` call as the host is asked it: whose browser, the action
 * and only the fields that action takes (`BROWSER_ACTION_SPECS`), under the
 * link's names, with a picture when the turn's model can read one. A click
 * that names a ref sends no point: the ref is what the bot meant.
 */
export function toHostBrowserRequest(
  call: BrowserCall,
  browser: string,
  picture: boolean,
): HostBrowserRequest {
  const request: Record<string, unknown> = { browser, action: call.action };
  for (const field of browserCallFields(call)) {
    if (call[field] === undefined) continue;
    if (call.ref && (field === 'x' || field === 'y')) continue;
    request[ON_THE_LINK[field]] = call[field];
  }
  if (picture && call.action !== 'close') request.picture = true;
  return request as HostBrowserRequest;
}
