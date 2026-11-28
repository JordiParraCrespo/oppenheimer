import { CLAUDE_POST, type ClaudePostAnswer, type ClaudePostMessage } from '@/content/tap-message';
import type { ClaudePost } from '@/sessions/chat';
import { CLAUDE_ORIGIN } from '@/sessions/links';

/**
 * Posts to claude.ai from one of its own tabs. claude.ai takes a write signed
 * with its cookies only from its own pages: the worker's request, from
 * `chrome-extension://…`, is refused (401), while the same request from the
 * page succeeds. So the post is handed to the content script in a claude.ai
 * tab (`content/bridge.ts`), which makes it with the page's origin.
 *
 * A tab already open is used when its script answers. Otherwise one is opened
 * in the background, on claude.ai/code, and closed again a minute after its
 * last post, so it is not left behind.
 */

/** How long a tab this opened stays after its last post. */
const OWN_TAB_IDLE_MS = 60_000;
/** How long a tab this opened may take to load. */
const LOAD_TIMEOUT_MS = 20_000;
/** How long the tab's script may take to answer: its post, and some room. */
const ANSWER_TIMEOUT_MS = 20_000;

let ownTab: number | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

export const postFromClaudeTab: ClaudePost = async (url, body, headers) => {
  const message: ClaudePostMessage = { type: CLAUDE_POST, url, body, headers };
  // claude.ai's tabs already open first; a tab of its own only when none answers.
  for (const tabId of [...(await openTabs()), 'own' as const]) {
    const id = tabId === 'own' ? await openOwnTab().catch(() => null) : tabId;
    if (id === null) break;
    const answer = await ask(id, message);
    // No script answered in that tab (opened before the extension, or gone):
    // nothing went, so the next tab is asked.
    if (answer === 'unreachable') continue;
    if (id === ownTab) closeLater();
    if ('status' in answer) return { status: answer.status };
    throw new Error(answer.error);
  }
  // No tab could take it: nothing went.
  return { status: NO_TAB };
};

/** The status for a post no claude.ai tab could take: nothing went. */
export const NO_TAB = 0;

/** claude.ai's tabs that have loaded. */
async function openTabs(): Promise<number[]> {
  const open = await chrome.tabs.query({ url: `${CLAUDE_ORIGIN}/*` }).catch(() => []);
  return open.flatMap((tab) =>
    tab.id !== undefined && tab.status === 'complete' && tab.id !== ownTab ? [tab.id] : [],
  );
}

async function ask(
  tabId: number,
  message: ClaudePostMessage,
): Promise<ClaudePostAnswer | 'unreachable'> {
  try {
    const answer = (await Promise.race([
      chrome.tabs.sendMessage(tabId, message),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('no answer')), ANSWER_TIMEOUT_MS),
      ),
    ])) as ClaudePostAnswer | undefined;
    return answer ?? 'unreachable';
  } catch (error) {
    // A tab with no script throws at once, before anything went. Anything
    // else (the tab closed mid-post, no answer in time) may have posted it.
    if (/Receiving end does not exist/i.test(String((error as Error).message)))
      return 'unreachable';
    return { error: 'no answer' };
  }
}
/** A claude.ai tab of this extension's own, loaded: the one already open, or a new one. */
async function openOwnTab(): Promise<number | null> {
  if (ownTab !== null) {
    const tab = await chrome.tabs.get(ownTab).catch(() => null);
    if (tab?.status === 'complete') return ownTab;
    if (!tab) ownTab = null;
  }
  if (ownTab === null) {
    const tab = await chrome.tabs.create({ url: `${CLAUDE_ORIGIN}/code`, active: false });
    if (tab.id === undefined) return null;
    ownTab = tab.id;
  }
  return waitLoaded(ownTab);
}

function waitLoaded(tabId: number): Promise<number | null> {
  return new Promise((resolve) => {
    const done = (loaded: boolean) => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(loaded ? tabId : null);
    };
    const listener = (id: number, change: { status?: string }) => {
      if (id === tabId && change.status === 'complete') done(true);
    };
    const timer = setTimeout(() => done(false), LOAD_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(listener);
    void chrome.tabs
      .get(tabId)
      .then((tab) => tab.status === 'complete' && done(true))
      .catch(() => done(false));
  });
}

function closeLater() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    const tabId = ownTab;
    ownTab = null;
    closeTimer = null;
    if (tabId !== null) void chrome.tabs.remove(tabId).catch(() => {});
  }, OWN_TAB_IDLE_MS);
}
