import type { TapMessage } from '@/content/tap-message';
import { createTranslator, reasonText } from '@/i18n/translator';
import { CLAUDE_ORIGIN, sessionUrl } from '@/sessions/links';
import { sendReport } from '@/sessions/report';
import {
  type CloudSessionRecord,
  isSessionRecord,
  nextCursor,
  sessionList,
  type TrackedSession,
} from '@/sessions/session';
import {
  disconnectOppenheimer,
  forgetEndpoint,
  type LearnedEndpoint,
  type OppenheimerConnection,
  readState,
  type SyncProblem,
  writeState,
} from '@/sessions/store';
import { ingest, needsYouCount } from '@/sessions/tracker';

/**
 * The service worker: keeps the list of your Claude Code cloud sessions,
 * works out which need you, and says so on the badge and in a notification.
 *
 * Two things feed it:
 * - the page: whatever claude.ai/code fetches while one of its tabs is open
 *   (`content/tap.ts`), which also teaches it the list endpoint;
 * - a poll every minute, asking that endpoint itself with the claude.ai
 *   sign-in already in this Chrome, so tracking goes on with no tab open.
 *
 * It holds no credential of its own: the request rides on the browser's
 * cookies for claude.ai, and nothing it stores is a cookie or a token.
 */

const POLL_ALARM = 'poll';

// The badge's and the notifications' words, in the language Chrome runs in.
const i18n = createTranslator(navigator.language);
const NOTIFICATION_PREFIX = 'session:';

// Tried in order, before the page has taught us the endpoint. They are what
// the Claude Code CLI calls on api.anthropic.com; claude.ai serves its app the same.
const PROBES = [
  `${CLAUDE_ORIGIN}/v1/code/sessions?limit=50`,
  `${CLAUDE_ORIGIN}/v1/sessions?limit=50`,
];
const BASE_HEADERS = {
  'anthropic-beta': 'ccr-byoc-2025-07-29',
  'anthropic-version': '2023-06-01',
};

chrome.runtime.onInstalled.addListener(() => void start());
chrome.runtime.onStartup.addListener(() => void start());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) void serial(poll);
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, reply) => {
  if (isTap(message)) {
    void serial(() => fromPage(message));
    return false;
  }
  if ((message as { type?: string })?.type === 'refresh') {
    void serial(poll).then(() => reply(true));
    return true;
  }
  if (isConnect(message)) {
    void serial(() => connect(message.connection)).then(reply);
    return true;
  }
  if ((message as { type?: string })?.type === 'disconnect') {
    void serial(disconnectOppenheimer).then(() => reply(true));
    return true;
  }
  return false;
});

chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith(NOTIFICATION_PREFIX)) return;
  void chrome.tabs.create({ url: sessionUrl(id.slice(NOTIFICATION_PREFIX.length)) });
  void chrome.notifications.clear(id);
});

async function start() {
  await chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  await serial(poll);
}

async function poll() {
  const { endpoint } = await readState();
  const urls = endpoint ? [endpoint.url] : PROBES;
  const organization = await organizationId();
  let failure: { problem: SyncProblem; detail: string } = {
    problem: 'not-found',
    detail: 'No sessions endpoint answered',
  };

  const headers = {
    ...BASE_HEADERS,
    ...(organization ? { 'x-organization-uuid': organization } : {}),
    ...endpoint?.headers,
  };

  for (const url of urls) {
    const path = new URL(url).pathname;
    try {
      const first = await fetch(url, { credentials: 'include', headers });
      if (first.status === 401 || first.status === 403) {
        failure = { problem: 'signed-out', detail: `${path} answered ${first.status}` };
        continue;
      }
      const body: unknown = first.ok ? await first.json() : null;
      const list = sessionList(body);
      if (!list) {
        failure = { problem: 'not-found', detail: `${path} answered ${first.status}` };
        continue;
      }
      if (!endpoint) await writeState({ endpoint: { url, headers: {}, from: 'probe' } });
      const { records, complete } = await remainingPages(url, headers, list, nextCursor(body));
      await record(records, complete);
      return;
    } catch (error) {
      failure = { problem: 'unreachable', detail: `${path}: ${String(error)}` };
    }
  }

  // An endpoint that stopped answering is forgotten: the next poll probes, and
  // the next visit to claude.ai/code teaches it again.
  if (endpoint && failure.problem !== 'signed-out') await forgetEndpoint();
  await writeState({ status: { ok: false, at: now(), ...failure } });
}

/** How many pages a poll reads before it settles for part of the list. */
const MAX_PAGES = 10;

/**
 * The rest of the list after its first page. Only a list read to its end is
 * complete, so a session missing from it was archived; one cut short by the
 * page cap or a failed page keeps every session it did not reach.
 */
async function remainingPages(
  url: string,
  headers: Record<string, string>,
  records: CloudSessionRecord[],
  cursor: string | null,
): Promise<{ records: CloudSessionRecord[]; complete: boolean }> {
  const all = [...records];
  let next = cursor;
  for (let page = 1; next && page < MAX_PAGES; page++) {
    const paged = new URL(url);
    paged.searchParams.set('cursor', next);
    const response = await fetch(paged, { credentials: 'include', headers }).catch(() => null);
    const body: unknown = response?.ok ? await response.json() : null;
    const list = sessionList(body);
    if (!list) return { records: all, complete: false };
    all.push(...list);
    next = nextCursor(body);
  }
  return { records: all, complete: next === null };
}

async function fromPage({ url, headers, body }: TapMessage) {
  const list = sessionList(body);
  if (list) {
    const learned = new URL(url);
    const paged = learned.searchParams.has('cursor') || learned.searchParams.has('after_id');
    for (const key of ['cursor', 'after_id', 'before_id']) learned.searchParams.delete(key);
    const endpoint: LearnedEndpoint = { url: learned.href, headers, from: 'page' };
    await writeState({ endpoint });
    // A page the app scrolled to, or a first page with more after it, is only
    // part of the list.
    await record(list, !paged && nextCursor(body) === null);
    return;
  }
  if (isSessionRecord(body)) await record([body], false);
}

async function record(records: CloudSessionRecord[], complete: boolean) {
  const state = await readState();
  const { sessions, moved } = ingest(state.sessions, records, {
    complete,
    baseline: !state.seeded,
  });
  await writeState({ sessions, seeded: true, status: { ok: true, at: now() } });
  for (const session of moved) notify(session);
  await drawBadge(needsYouCount(sessions));
  await report();
}

/**
 * Tells Oppenheimer what the cloud sessions are doing, when the person
 * connected it: every tracked session, after every check. The API records the
 * ones its workspace launched and drops the rest, and writes only what is new.
 */
async function report() {
  const { oppenheimer, sessions } = await readState();
  if (!oppenheimer) return;
  try {
    const matched = await sendReport(oppenheimer, sessions);
    await writeState({ report: { ok: true, at: now(), matched } });
  } catch (error) {
    await writeState({
      report: { ok: false, at: now(), detail: String((error as Error).message ?? error) },
    });
  }
}

/**
 * Keeps a connection only once the API took a report with it: a wrong URL or
 * token is answered in the popup, not stored to fail every minute.
 */
async function connect(
  connection: OppenheimerConnection,
): Promise<{ ok: boolean; detail?: string }> {
  const { sessions } = await readState();
  try {
    const matched = await sendReport(connection, sessions);
    await writeState({ oppenheimer: connection, report: { ok: true, at: now(), matched } });
    return { ok: true };
  } catch (error) {
    return { ok: false, detail: String((error as Error).message ?? error) };
  }
}

async function drawBadge(count: number) {
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  await chrome.action.setTitle({
    title: count === 0 ? i18n.t('badge.none') : i18n.t('badge.needsYou', { count }),
  });
}

function notify(session: TrackedSession) {
  void chrome.notifications.create(`${NOTIFICATION_PREFIX}${session.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: `${i18n.t(`state.${session.state}`)}: ${session.title}`,
    message:
      [reasonText(i18n.t, session.reason), session.repo].filter(Boolean).join(' · ') ||
      i18n.t('notification.open'),
    priority: session.state === 'done' ? 0 : 2,
  });
}

/** claude.ai remembers the organization last used in this cookie. Its value is an id, not a secret. */
async function organizationId() {
  const cookie = await chrome.cookies
    .get({ url: CLAUDE_ORIGIN, name: 'lastActiveOrg' })
    .catch(() => null);
  return cookie?.value || null;
}

function isConnect(
  message: unknown,
): message is { type: 'connect'; connection: OppenheimerConnection } {
  const candidate = message as { type?: string; connection?: Partial<OppenheimerConnection> };
  return (
    candidate?.type === 'connect' &&
    typeof candidate.connection?.apiUrl === 'string' &&
    typeof candidate.connection?.token === 'string'
  );
}

function isTap(message: unknown): message is TapMessage {
  return (message as TapMessage | undefined)?.type === 'tap';
}

function now() {
  return new Date().toISOString();
}

// Storage is read, changed and written back; a page update and a poll landing
// together would otherwise drop one another's sessions.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}
