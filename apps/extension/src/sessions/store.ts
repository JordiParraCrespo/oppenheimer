import type { TrackedSessions } from './tracker';

/**
 * Everything the extension keeps, in `chrome.storage.local`. The service
 * worker is the only writer; the popup reads it and listens for changes.
 */
export interface StoredState {
  sessions: TrackedSessions;
  /** Set once the first list is in: later moves notify, the first one does not. */
  seeded: boolean;
  /** The list endpoint, as learned from claude.ai's own request or found by probing. */
  endpoint?: LearnedEndpoint;
  status?: SyncStatus;
  /** Where the statuses are reported, once the person connected Oppenheimer. */
  oppenheimer?: OppenheimerConnection;
  /** How the last report went. */
  report?: ReportStatus;
}

/**
 * The person's Oppenheimer API and a personal API token with `sessions:write`.
 * The token is theirs, for their own API: it is not a claude.ai credential,
 * and nothing of claude.ai's is ever sent with it.
 */
export interface OppenheimerConnection {
  /** The API's origin, e.g. `https://api.example.com` or `http://localhost:3001`. */
  apiUrl: string;
  token: string;
}

export type ReportStatus =
  | { ok: true; at: string; matched: number }
  | { ok: false; at: string; detail: string };

export interface LearnedEndpoint {
  url: string;
  /** The `anthropic-*` / `x-organization-*` headers claude.ai sent. Never a cookie or a token. */
  headers: Record<string, string>;
  from: 'page' | 'probe';
}

export type SyncStatus =
  | { ok: true; at: string }
  | { ok: false; at: string; problem: SyncProblem; detail: string };

/** What went wrong, as the popup words it. */
export type SyncProblem = 'signed-out' | 'not-found' | 'unreachable';

const KEYS = ['sessions', 'seeded', 'endpoint', 'status', 'oppenheimer', 'report'] as const;

export async function readState(): Promise<StoredState> {
  const stored = (await chrome.storage.local.get([...KEYS])) as Partial<StoredState>;
  return { sessions: {}, seeded: false, ...stored };
}

export async function writeState(patch: Partial<StoredState>) {
  await chrome.storage.local.set(patch);
}

export async function forgetEndpoint() {
  await chrome.storage.local.remove('endpoint');
}

export async function disconnectOppenheimer() {
  await chrome.storage.local.remove(['oppenheimer', 'report']);
}
