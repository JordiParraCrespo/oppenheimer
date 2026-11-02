/**
 * Leaves this page for `url`, as following a link would. The one way the
 * kit sends this tab elsewhere, so a spec observes the departure by mocking
 * this module: a browser's `location` cannot be redefined, and neither can
 * jsdom's.
 */
export function leaveFor(url: string): void {
  window.location.assign(url);
}
