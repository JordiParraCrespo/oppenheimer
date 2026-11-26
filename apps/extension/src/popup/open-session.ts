import { sessionUrl } from '@/sessions/links';

/** Opens a session on claude.ai/code in a new tab and closes the popup. */
export function openSession(id: string) {
  void chrome.tabs.create({ url: sessionUrl(id) });
  window.close();
}
