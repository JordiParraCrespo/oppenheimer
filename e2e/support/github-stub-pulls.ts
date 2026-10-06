/**
 * The pull requests half of the GitHub stub: open and recently merged pull
 * requests per repository, their files, reviews, comments and checks, and the
 * writes the console makes in the user's name (reviews, comments, merges).
 *
 * Shapes are GitHub's REST answers. Times are relative to when the stub
 * started, so the queue's waits and the analytics' periods hold on any day.
 * Branches named `oppenheimer/…` are the ones a session pushes.
 */

interface StubUser {
  login: string;
  type: 'User' | 'Bot';
}

interface StubFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  previous_filename?: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface StubReview {
  id: number;
  user: StubUser;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  submitted_at: string;
  body: string;
}

interface StubComment {
  id: number;
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
  user: StubUser;
  created_at: string;
}

type CheckOutcome = 'success' | 'failure' | 'in_progress';

interface StubPull {
  number: number;
  title: string;
  body: string;
  user: StubUser;
  draft: boolean;
  state: 'open' | 'closed';
  merged: boolean;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  requested_reviewers: StubUser[];
  mergeable: boolean | null;
  mergeable_state: string;
  files: StubFile[];
  reviews: StubReview[];
  comments: StubComment[];
  checks: CheckOutcome[];
}

export interface PullsRepository {
  id: number;
  full_name: string;
  default_branch: string;
}

const HOUR = 3_600_000;
const person = (login: string): StubUser => ({ login, type: 'User' });

/** A unified diff GitHub would show for `added` new lines and `removed` old ones. */
function patchOf(added: string[], removed: string[] = [], context: string[] = []): string {
  const header = `@@ -1,${removed.length + context.length} +1,${added.length + context.length} @@`;
  return [
    header,
    ...context.map((line) => ` ${line}`),
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join('\n');
}

function file(
  filename: string,
  added: string[],
  removed: string[] = [],
  context: string[] = [],
): StubFile {
  return {
    filename,
    status: removed.length === 0 && context.length === 0 ? 'added' : 'modified',
    additions: added.length,
    deletions: removed.length,
    patch: patchOf(added, removed, context),
  };
}

/** A file whose size matters more than its text: a lockfile, a generated client. */
function bulkFile(filename: string, additions: number, deletions: number): StubFile {
  return { filename, status: 'modified', additions, deletions };
}

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return 90_000 + sequence;
};

function shaOf(repository: number, number: number, revision = 0): string {
  return `${repository.toString(16)}${number.toString(16).padStart(4, '0')}${revision}`.padEnd(
    40,
    'a',
  );
}

interface Seed {
  number: number;
  title: string;
  body: string;
  author: string;
  head: string;
  hoursAgo: number;
  files: StubFile[];
  checks: CheckOutcome[];
  reviews?: { login: string; state: StubReview['state']; hoursAgo: number }[];
  requested?: string[];
  draft?: boolean;
  mergeableState?: 'clean' | 'blocked' | 'dirty' | 'behind' | 'unstable';
  mergedHoursAgo?: number;
}

function pullOf(repository: PullsRepository, seed: Seed, now: number): StubPull {
  const at = (hours: number) => new Date(now - hours * HOUR).toISOString();
  const merged = seed.mergedHoursAgo !== undefined;
  const reviews = (seed.reviews ?? []).map((review) => ({
    id: nextId(),
    user: person(review.login),
    state: review.state,
    submitted_at: at(review.hoursAgo),
    body: '',
  }));
  const state = seed.mergeableState ?? 'clean';
  return {
    number: seed.number,
    title: seed.title,
    body: seed.body,
    user: seed.author.endsWith('[bot]') ? { login: seed.author, type: 'Bot' } : person(seed.author),
    draft: seed.draft ?? false,
    state: merged ? 'closed' : 'open',
    merged,
    merged_at: merged ? at(seed.mergedHoursAgo as number) : null,
    closed_at: merged ? at(seed.mergedHoursAgo as number) : null,
    created_at: at(seed.hoursAgo),
    updated_at: at(
      Math.min(
        seed.hoursAgo,
        seed.mergedHoursAgo ?? Infinity,
        ...(seed.reviews ?? []).map((r) => r.hoursAgo),
      ),
    ),
    head: { ref: seed.head, sha: shaOf(repository.id, seed.number) },
    base: { ref: repository.default_branch },
    requested_reviewers: (seed.requested ?? []).map(person),
    mergeable: state !== 'dirty',
    mergeable_state: seed.draft ? 'draft' : state,
    files: seed.files,
    reviews,
    comments: [],
    checks: seed.checks,
  };
}

/** The open pull requests of the first repository: one per lane and per blocker the queue shows. */
function firstRepositorySeeds(viewer: string): Seed[] {
  return [
    {
      number: 12,
      title: 'Store wallet tokens in the Keychain',
      body: [
        '## What',
        'Wallet session tokens move from AsyncStorage to the iOS Keychain and the Android Keystore.',
        '',
        '## Why',
        'AsyncStorage is readable on a rooted device. The Keychain is not.',
        '',
        '## How to review',
        '- `src/auth/keychain.ts` is the new store; everything else calls it.',
        '- The migration reads the old token once and deletes it.',
      ].join('\n'),
      author: viewer,
      head: 'oppenheimer/keychain-tokens',
      hoursAgo: 26,
      files: [
        file('src/auth/keychain.ts', [
          "import * as Keychain from 'react-native-keychain';",
          '',
          'export async function saveToken(token: string): Promise<void> {',
          "  await Keychain.setGenericPassword('wallet', token, { service: 'xrp.wallet' });",
          '}',
          '',
          'export async function readToken(): Promise<string | null> {',
          "  const entry = await Keychain.getGenericPassword({ service: 'xrp.wallet' });",
          '  return entry ? entry.password : null;',
          '}',
        ]),
        file(
          'src/auth/session.ts',
          ["import { readToken, saveToken } from './keychain';", '  await saveToken(token);'],
          [
            "import AsyncStorage from '@react-native-async-storage/async-storage';",
            "  await AsyncStorage.setItem('token', token);",
          ],
          ['export async function signIn(token: string) {'],
        ),
        file('src/auth/__tests__/keychain.spec.ts', [
          "it('keeps the token in the Keychain', async () => {",
          "  await saveToken('t');",
          "  expect(await readToken()).toBe('t');",
          '});',
        ]),
      ],
      checks: ['success', 'success', 'success'],
      reviews: [{ login: 'lucia-m', state: 'COMMENTED', hoursAgo: 20 }],
      requested: ['pau-g'],
      mergeableState: 'blocked',
    },
    {
      number: 14,
      title: 'Fix the empty state on the wallet screen',
      body: 'The wallet screen showed a spinner forever when there were no accounts. It now says so and offers to add one.',
      author: 'lucia-m',
      head: 'fix/wallet-empty-state',
      hoursAgo: 5,
      files: [
        file(
          'src/screens/wallet/WalletScreen.tsx',
          ['  if (accounts.length === 0) return <EmptyWallet onAdd={addAccount} />;'],
          ['  if (accounts.length === 0) return <Spinner />;'],
          ['export function WalletScreen() {', '  const accounts = useAccounts();'],
        ),
        file('src/screens/wallet/EmptyWallet.tsx', [
          'export function EmptyWallet({ onAdd }: { onAdd: () => void }) {',
          '  return <Empty title="No accounts yet" action={<Button onPress={onAdd}>Add an account</Button>} />;',
          '}',
        ]),
      ],
      checks: ['success', 'success'],
      requested: [viewer],
    },
    {
      number: 15,
      title: 'Bump react-native to 0.80',
      body: 'Updates react-native from 0.79.2 to 0.80.0.',
      author: 'renovate[bot]',
      head: 'renovate/react-native-0.x',
      hoursAgo: 52,
      files: [
        file('package.json', ['    "react-native": "0.80.0",'], ['    "react-native": "0.79.2",']),
        bulkFile('ios/Podfile.lock', 180, 164),
        bulkFile('src/native/bridge.ts', 40, 22),
      ],
      checks: ['success', 'failure', 'success'],
      mergeableState: 'unstable',
    },
    {
      number: 16,
      title: 'Write down the release checklist',
      body: 'The steps we follow for a store release, so the next one does not depend on memory.',
      author: viewer,
      head: 'oppenheimer/release-checklist',
      hoursAgo: 3,
      files: [
        file('docs/release.md', [
          '# Releasing',
          '',
          '1. Bump the version in `app.json`.',
          '2. Run `pnpm build:ios` and `pnpm build:android`.',
          '3. Upload both builds and submit for review.',
        ]),
      ],
      checks: ['success'],
      reviews: [{ login: 'lucia-m', state: 'APPROVED', hoursAgo: 1 }],
    },
  ];
}

function secondRepositorySeeds(viewer: string): Seed[] {
  return [
    {
      number: 31,
      title: 'Rework the settings layout',
      body: 'Settings move to a two-column layout with a sticky section list, as the design draws it.',
      author: 'pau-g',
      head: 'settings-layout',
      hoursAgo: 30,
      files: [
        file(
          'src/settings/SettingsPage.tsx',
          ['  return <TwoColumn aside={<SectionList />}>{children}</TwoColumn>;'],
          ['  return <Stack>{children}</Stack>;'],
          ['export function SettingsPage({ children }: Props) {'],
        ),
        bulkFile('src/settings/SectionList.tsx', 120, 0),
        bulkFile('src/settings/sections.ts', 64, 18),
      ],
      checks: ['success', 'in_progress'],
      requested: [viewer],
    },
    {
      number: 33,
      title: 'Migrate the sessions table to timestamptz',
      body: 'Every date column in `sessions` becomes `timestamptz`, with a backfill that reads the old values as UTC.',
      author: 'lucia-m',
      head: 'migrate-sessions-tz',
      hoursAgo: 74,
      files: [
        file('db/migrations/0042_sessions_timestamptz.sql', [
          "ALTER TABLE sessions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';",
        ]),
      ],
      checks: ['success'],
      reviews: [{ login: 'pau-g', state: 'CHANGES_REQUESTED', hoursAgo: 60 }],
      mergeableState: 'dirty',
    },
    {
      number: 34,
      title: 'Dark mode for the dashboard',
      body: 'Work in progress.',
      author: viewer,
      head: 'oppenheimer/dashboard-dark-mode',
      hoursAgo: 8,
      files: [bulkFile('src/theme/dark.css', 90, 4)],
      checks: ['in_progress'],
      draft: true,
    },
  ];
}

/** Merged pull requests over the last eight weeks, for the analytics' two periods. */
function mergedSeeds(viewer: string, base: number, count: number): Seed[] {
  const authors = [viewer, 'lucia-m', 'pau-g', viewer, 'renovate[bot]'];
  return Array.from({ length: count }, (_, index) => {
    const author = authors[index % authors.length] as string;
    const session = author === viewer && index % 2 === 0;
    const hoursAgo = 12 + index * 31;
    const waitForReview = 1 + (index % 6) * 2;
    const reviewer = author === viewer ? 'lucia-m' : viewer;
    const size = (index * 37) % 260;
    return {
      number: base + index,
      title: `Merged change ${base + index}`,
      body: '',
      author,
      head: session ? `oppenheimer/change-${base + index}` : `change-${base + index}`,
      hoursAgo,
      files:
        index % 4 === 0
          ? [file(`docs/notes-${index}.md`, ['A note.'])]
          : index % 7 === 0
            ? [bulkFile(`src/auth/rule-${index}.ts`, 20, 4)]
            : [bulkFile(`src/feature-${index}.ts`, size, Math.round(size / 3))],
      checks: ['success'],
      reviews: [{ login: reviewer, state: 'APPROVED', hoursAgo: hoursAgo - waitForReview }],
      mergedHoursAgo: hoursAgo - waitForReview - 2,
    };
  });
}

export interface PullsStub {
  /** Answers a GitHub pull request route, or null when the path is not one. */
  handle(
    method: string,
    path: string,
    query: URLSearchParams,
    body: unknown,
  ): { status: number; body: unknown } | null;
}

export function createPullsStub(
  repositories: readonly PullsRepository[],
  viewerLogin: string,
  now = Date.now(),
): PullsStub {
  const byRepository = new Map<string, StubPull[]>();
  const [first, second] = repositories;
  /** Every pull request back as seeded: a suite that merges one resets first, so a rerun finds it open. */
  const seed = () => {
    byRepository.clear();
    if (first) {
      byRepository.set(first.full_name, [
        ...firstRepositorySeeds(viewerLogin).map((s) => pullOf(first, s, now)),
        ...mergedSeeds(viewerLogin, 100, 26).map((s) => pullOf(first, s, now)),
      ]);
    }
    if (second) {
      byRepository.set(second.full_name, [
        ...secondRepositorySeeds(viewerLogin).map((s) => pullOf(second, s, now)),
        ...mergedSeeds(viewerLogin, 200, 14).map((s) => pullOf(second, s, now)),
      ]);
    }
  };
  seed();

  const touch = (pull: StubPull) => {
    pull.updated_at = new Date().toISOString();
  };

  const summary = (fullName: string, pull: StubPull) => {
    const {
      files: _files,
      reviews: _reviews,
      comments: _comments,
      checks: _checks,
      ...rest
    } = pull;
    return { ...rest, html_url: `https://github.com/${fullName}/pull/${pull.number}` };
  };
  const detail = (fullName: string, pull: StubPull) => ({
    ...summary(fullName, pull),
    additions: pull.files.reduce((sum, f) => sum + f.additions, 0),
    deletions: pull.files.reduce((sum, f) => sum + f.deletions, 0),
    changed_files: pull.files.length,
  });

  const findBySha = (sha: string) => {
    for (const pulls of byRepository.values()) {
      const found = pulls.find((pull) => pull.head.sha === sha);
      if (found) return found;
    }
    return undefined;
  };

  const approvedNow = (pull: StubPull) => {
    const latest = new Map<string, string>();
    for (const review of pull.reviews) {
      if (review.state !== 'COMMENTED') latest.set(review.user.login, review.state);
    }
    const verdicts = [...latest.values()];
    return verdicts.includes('APPROVED') && !verdicts.includes('CHANGES_REQUESTED');
  };

  return {
    handle(method, path, query, body) {
      if (path === '/__stub/pulls/reset' && method === 'POST') {
        seed();
        return { status: 200, body: { reset: true } };
      }
      const repo = /^\/repos\/([^/]+)\/([^/]+)\/(.+)$/.exec(path);
      if (!repo) return null;
      const fullName = `${decodeURIComponent(repo[1] ?? '')}/${decodeURIComponent(repo[2] ?? '')}`;
      const rest = repo[3] ?? '';

      const checks = /^commits\/([0-9a-f]+)\/(check-runs|status)$/.exec(rest);
      if (checks) {
        const pull = findBySha(checks[1] ?? '');
        if (checks[2] === 'status')
          return { status: 200, body: { state: 'success', statuses: [] } };
        const runs = (pull?.checks ?? []).map((outcome, index) => ({
          id: index + 1,
          name: ['build', 'test', 'lint'][index] ?? `check-${index}`,
          status: outcome === 'in_progress' ? 'in_progress' : 'completed',
          conclusion: outcome === 'in_progress' ? null : outcome,
        }));
        return { status: 200, body: { total_count: runs.length, check_runs: runs } };
      }

      const pulls = byRepository.get(fullName);
      if (!pulls) return null;

      // The list: newest update first, without the briefing's counts, as GitHub answers it.
      if (rest === 'pulls' && method === 'GET') {
        const state = query.get('state') ?? 'open';
        const listed = pulls
          .filter((pull) => state === 'all' || pull.state === state)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((pull) => summary(fullName, pull));
        return { status: 200, body: listed };
      }

      const route = /^pulls\/(\d+)(?:\/(files|reviews|comments|merge))?$/.exec(rest);
      if (!route) return null;
      const pull = pulls.find((candidate) => candidate.number === Number(route[1]));
      if (!pull) return { status: 404, body: { message: 'Not Found' } };
      const input = (body ?? {}) as Record<string, unknown>;

      switch (`${method} ${route[2] ?? ''}`) {
        case 'GET ':
          return { status: 200, body: detail(fullName, pull) };
        case 'GET files':
          return { status: 200, body: pull.files };
        case 'GET reviews':
          return { status: 200, body: pull.reviews };
        case 'GET comments':
          return { status: 200, body: pull.comments };
        case 'POST reviews': {
          const event = String(input.event ?? 'COMMENT');
          const state =
            event === 'APPROVE'
              ? 'APPROVED'
              : event === 'REQUEST_CHANGES'
                ? 'CHANGES_REQUESTED'
                : 'COMMENTED';
          const submitted = new Date().toISOString();
          pull.reviews.push({
            id: nextId(),
            user: person(viewerLogin),
            state,
            submitted_at: submitted,
            body: String(input.body ?? ''),
          });
          for (const comment of (input.comments as Record<string, unknown>[] | undefined) ?? []) {
            pull.comments.push({
              id: nextId(),
              path: String(comment.path),
              line: Number(comment.line),
              side: comment.side === 'LEFT' ? 'LEFT' : 'RIGHT',
              body: String(comment.body),
              user: person(viewerLogin),
              created_at: submitted,
            });
          }
          pull.requested_reviewers = pull.requested_reviewers.filter(
            (r) => r.login !== viewerLogin,
          );
          // A required approval is what `blocked` waits on here; one lifts it.
          if (pull.mergeable_state === 'blocked' && approvedNow(pull))
            pull.mergeable_state = 'clean';
          touch(pull);
          return { status: 200, body: { id: nextId(), state } };
        }
        case 'POST comments': {
          const created = {
            id: nextId(),
            path: String(input.path),
            line: Number(input.line),
            side: input.side === 'LEFT' ? ('LEFT' as const) : ('RIGHT' as const),
            body: String(input.body),
            user: person(viewerLogin),
            created_at: new Date().toISOString(),
          };
          pull.comments.push(created);
          touch(pull);
          return { status: 201, body: created };
        }
        case 'PUT merge': {
          if (pull.merged)
            return { status: 405, body: { message: 'Pull Request is not mergeable' } };
          if (input.sha && input.sha !== pull.head.sha) {
            return {
              status: 409,
              body: { message: 'Head branch was modified. Review and try the merge again.' },
            };
          }
          const passing = pull.checks.every((outcome) => outcome === 'success');
          if (
            pull.draft ||
            pull.mergeable === false ||
            pull.mergeable_state !== 'clean' ||
            !passing
          ) {
            return { status: 405, body: { message: 'Pull Request is not mergeable' } };
          }
          const at = new Date().toISOString();
          Object.assign(pull, { merged: true, state: 'closed', merged_at: at, closed_at: at });
          touch(pull);
          return {
            status: 200,
            body: { sha: pull.head.sha, merged: true, message: 'Pull Request successfully merged' },
          };
        }
        default:
          return null;
      }
    },
  };
}
