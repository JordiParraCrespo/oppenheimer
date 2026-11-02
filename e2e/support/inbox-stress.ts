import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { type ChatAnswer, questionKeys } from '../../packages/shared/src/sessions/question-keys';
import type { FleetHost } from './fleet';
import { appendTranscript, transcriptEntry } from './session-chat';
import { STUB_REPOSITORIES } from './sessions';

/**
 * The Inbox stress spec's hands on a session (`tests/fleet/inbox-stress.spec.ts`):
 * what each scenario prints in the fleet shim's shell, driven through the
 * host's own tmux rather than a browser per session, and what the shell
 * received, read back off the host.
 *
 * A waiting session's shell takes the terminal raw, reads exactly the bytes
 * its answer should be, then keeps reading for a window after them, so a key
 * typed twice or meant for another session lands in the same file. The file
 * is the proof; `GOT:<hex>` on the screen is for a person watching.
 */

/** Octal-free: the dialog's text is written to a file on the host, not typed. */
const RULE = '─'.repeat(60);
const CURSOR = '❯';

/** How long a waiting shell keeps reading after its answer, for a duplicate or a stray. */
const EXTRA_WINDOW_S = 12;

export interface PermissionScenario {
  kind: 'permission';
  /** The lines drawn above the options (a tool, a command, a file). */
  above: string[];
  title: string;
  /** Labels as the dialog wraps them: a string per screen line, the first carrying the number. */
  options: string[][];
  /** Draw it in a box, as releases before the rule did. */
  boxed?: boolean;
  /** The option the Inbox answers with, from 0. */
  answer: number;
}

export interface QuestionScenario {
  kind: 'question';
  toolUseId: string;
  questions: {
    header?: string;
    question: string;
    multiSelect: boolean;
    options: { label: string; description?: string }[];
  }[];
  answers: ChatAnswer[];
}

export type WaitingScenario = PermissionScenario | QuestionScenario;

/** A label's bound in the decision schema, in bytes on the runner. */
const LABEL_MAX = 100;

/**
 * The option labels as the Inbox should draw them: each wrapped label joined,
 * and one past the schema's bound cut to it with an ellipsis (ASCII here).
 */
export function permissionLabels(scenario: PermissionScenario): string[] {
  return scenario.options.map((lines) => {
    const label = lines.join(' ').trim();
    return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 3)}…` : label;
  });
}

/** The bytes the answer types, as hex: the option's digit, or `questionKeys`. */
export function expectedHex(scenario: WaitingScenario): string {
  const keys =
    scenario.kind === 'permission'
      ? [String(scenario.answer + 1)]
      : questionKeys(scenario.questions, scenario.answers);
  return Buffer.from(keys.join(''), 'utf8').toString('hex');
}

/** What a permission dialog looks like on screen, Claude Code 2.x's shape. */
function permissionScreen(scenario: PermissionScenario): string {
  const lines: string[] = [];
  scenario.options.forEach((wrapped, index) => {
    const mark = index === 0 ? ` ${CURSOR} ` : '   ';
    lines.push(`${mark}${index + 1}. ${wrapped[0]}`);
    for (const more of wrapped.slice(1)) lines.push(`      ${more}`);
  });
  const body = [...scenario.above.map((line) => ` ${line}`), '', ` ${scenario.title}`, ...lines];
  if (!scenario.boxed) return [RULE, ...body, '', ' Esc to cancel', ''].join('\n');
  const width = 70;
  const pad = (line: string) => `│${line}${' '.repeat(Math.max(0, width - [...line].length))}│`;
  return [
    `╭${'─'.repeat(width)}╮`,
    ...body.map(pad),
    `╰${'─'.repeat(width)}╯`,
    '   Esc to cancel',
    '',
  ].join('\n');
}

function tmux(host: FleetHost, args: string): string {
  return host.exec(`tmux -L oppenheimer ${args}`);
}

const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

export function paneText(host: FleetHost, sessionId: string): string {
  try {
    return tmux(host, `capture-pane -p -t opp-${sessionId}:0`);
  } catch {
    return '';
  }
}

function put(host: FleetHost, name: string, content: string): void {
  const body = Buffer.from(content).toString('base64');
  host.exec(`mkdir -p ~/stress && echo ${body} | base64 -d > ~/stress/${name}`);
}

/** Types a command into the session's agent window and presses Enter, as a person would. */
function run(host: FleetHost, sessionId: string, command: string): void {
  tmux(host, `send-keys -t opp-${sessionId}:0 -l ${quote(command)}`);
  tmux(host, `send-keys -t opp-${sessionId}:0 Enter`);
}

/** The shim is up in the pane and its shell takes input. */
export async function waitForShim(host: FleetHost, sessionId: string): Promise<void> {
  await expect
    .poll(() => paneText(host, sessionId).includes('CLAUDE-SHIM argv='), {
      message: `${sessionId}'s claude shim\n${host.logs().slice(-1_500)}`,
      timeout: 180_000,
      intervals: [1_000, 2_000],
    })
    .toBe(true);
}

/**
 * Draws the round's screen, then reads `bytes` raw bytes and whatever follows them for
 * a window into `~/stress/<round>.got`, and says it finished in `.done`.
 */
function readingScript(round: string, bytes: number): string {
  return [
    'clear',
    `cat ~/stress/${round}.screen`,
    'stty raw -echo',
    `dd bs=1 count=${bytes} of=$HOME/stress/${round}.got status=none`,
    `timeout ${EXTRA_WINDOW_S} dd bs=1 count=256 status=none >> $HOME/stress/${round}.got`,
    'stty sane',
    'clear',
    `printf 'GOT:'; od -An -tx1 $HOME/stress/${round}.got | tr -d ' \\n'; echo`,
    `touch ~/stress/${round}.done`,
    '',
  ].join('\n');
}

/**
 * Puts a session into a waiting scenario: a permission dialog on its screen,
 * or a question in its transcript with Claude's waiting line on screen, and a
 * shell that records what it is sent. `round` names this wait's files, so a
 * follow-up on the same session gets its own.
 */
export function startWaiting(
  host: FleetHost,
  sessionId: string,
  round: string,
  scenario: WaitingScenario,
): void {
  const bytes = Buffer.from(expectedHex(scenario), 'hex').length;
  if (scenario.kind === 'permission') {
    put(host, `${round}.screen`, permissionScreen(scenario));
  } else {
    appendTranscript(host, sessionId, [
      transcriptEntry('assistant', `${scenario.toolUseId}-call`, [
        {
          type: 'tool_use',
          id: scenario.toolUseId,
          name: 'AskUserQuestion',
          input: { questions: scenario.questions },
        },
      ]),
    ]);
    put(host, `${round}.screen`, 'Claude is waiting for your input\n');
  }
  put(host, `${round}.sh`, readingScript(round, bytes));
  run(host, sessionId, `sh ~/stress/${round}.sh`);
}

/** The agent took the question's answer: its call has a result in the transcript. */
export function answerInTranscript(host: FleetHost, sessionId: string, toolUseId: string): void {
  appendTranscript(host, sessionId, [
    transcriptEntry('user', `${toolUseId}-result`, [
      { type: 'tool_result', tool_use_id: toolUseId, content: 'User has answered your questions.' },
    ]),
  ]);
}

/** Ends what a held screen runs (Ctrl-C), so the shim's shell takes a command again. */
export function release(host: FleetHost, sessionId: string): void {
  tmux(host, `send-keys -t opp-${sessionId}:0 C-c`);
}

/** A screen that holds still: a spinner, a prompt, a question with nothing to read. */
export function holdScreen(host: FleetHost, sessionId: string, name: string, screen: string): void {
  put(host, `${name}.screen`, screen);
  put(host, `${name}.sh`, `clear\ncat ~/stress/${name}.screen\nexec sleep 100000\n`);
  run(host, sessionId, `sh ~/stress/${name}.sh`);
}

/** What the round's shell received, as hex, once its window closed; undefined before. */
export function received(host: FleetHost, round: string): string | undefined {
  const out = host.exec(
    `test -f ~/stress/${round}.done && od -An -tx1 ~/stress/${round}.got | tr -d ' \\n' && echo || echo PENDING`,
  );
  return out === 'PENDING' ? undefined : out.trim();
}

let counter = 0;

/** `POST /sessions` with what the stress needs: a project, a base branch. */
export async function createStressSession(
  api: APIRequestContext,
  hostId: string,
  installationId: string,
  { projectId, baseBranch }: { projectId?: string; baseBranch?: string } = {},
): Promise<string> {
  counter += 1;
  const key = `stress-${process.pid}-${counter}-${Date.now()}`;
  // Starting a session is throttled per caller (20 a minute); thirty at once
  // wait their turn, with the same key, as a client that read Retry-After would.
  const post = () =>
    api.post('/api/v1/sessions', {
      headers: { 'Idempotency-Key': key },
      data: body,
      failOnStatusCode: false,
    });
  const body = {
    hostId,
    agent: 'claude-code',
    ...(projectId ? { projectId } : {}),
    checkouts: [
      {
        installationId,
        githubRepoId: STUB_REPOSITORIES.mobile.githubRepoId,
        ...(baseBranch ? { baseBranch } : {}),
      },
    ],
  };
  let created = await post();
  for (let attempt = 0; created.status() === 429 && attempt < 6; attempt += 1) {
    const wait = Number(created.headers()['retry-after'] ?? 30);
    await new Promise((resolve) => setTimeout(resolve, (wait + 1) * 1_000));
    created = await post();
  }
  expect(created.status(), await created.text()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

/** The permission dialogs the stress prints, a mix of tools, shapes and option counts. */
export const PERMISSIONS: PermissionScenario[] = [
  {
    kind: 'permission',
    above: ['Bash command', '', '  pnpm generate:api-client', '  Regenerate the typed API client'],
    title: 'Do you want to proceed?',
    options: [
      ['Yes'],
      ["Yes, and don't ask again for pnpm commands in /home/runner/xrp-mobile"],
      ['No, and tell Claude what to do differently (esc)'],
    ],
    answer: 0,
  },
  {
    kind: 'permission',
    above: ['Edit file', '', '  src/app.ts', '  +  export const wallet = createWallet();'],
    title: 'Do you want to make this edit to src/app.ts?',
    options: [
      ['Yes'],
      ['Yes, allow all edits during this session (shift+tab)'],
      ['No, and tell Claude what to do differently (esc)'],
    ],
    answer: 1,
  },
  {
    kind: 'permission',
    above: ['Create file', '', '  src/wallet/empty-state.tsx'],
    title: 'Do you want to create empty-state.tsx?',
    options: [
      ['Yes'],
      ['Yes, allow all edits during this session (shift+tab)'],
      ['No, and tell Claude what to do differently (esc)'],
    ],
    answer: 2,
  },
  {
    kind: 'permission',
    above: ['Bash command', '', '  rm -rf node_modules/.cache'],
    title: 'Do you want to proceed?',
    options: [['Yes'], ['No']],
    answer: 1,
  },
  {
    kind: 'permission',
    above: [
      'Fetch',
      '',
      '  https://docs.anthropic.com/en/docs/claude-code',
      '  Claude wants to fetch content from docs.anthropic.com',
    ],
    title: 'Do you want to allow Claude to fetch this content?',
    options: [
      ['Yes'],
      ["Yes, and don't ask again for docs.anthropic.com"],
      ['No, and tell Claude what to do differently (esc)'],
    ],
    answer: 0,
  },
  {
    kind: 'permission',
    above: [
      'Bash command',
      '',
      '  pnpm --filter @oppenheimer/api test:integration -- --run sessions',
    ],
    title: 'Do you want to proceed?',
    options: [
      ['Yes'],
      [
        "Yes, and don't ask again for pnpm --filter @oppenheimer/api test:integration",
        'commands in /home/runner/oppenheimer-ai/sessions/xrp-mobile and every',
        'directory below it',
      ],
      ['No, and tell Claude what to do differently (esc)'],
    ],
    answer: 1,
  },
  {
    kind: 'permission',
    boxed: true,
    above: ['Bash command', '', '  git push origin HEAD'],
    title: 'Do you want to proceed?',
    options: [['Yes'], ["Yes, and don't ask again for git push commands"], ['No (esc)']],
    answer: 2,
  },
  {
    kind: 'permission',
    above: [
      'Tool use',
      '',
      '  github - create_pull_request(title: "Wallet empty state")',
      '  (MCP)',
    ],
    title: 'Do you want to proceed?',
    options: [
      ['Yes'],
      ["Yes, and don't ask again for github - create_pull_request commands"],
      ['No, and tell Claude what to do differently (esc)'],
    ],
    answer: 0,
  },
];

const option = (label: string, description?: string) =>
  description ? { label, description } : { label };

/** The questions the stress asks, from one choice to four questions with words of their own. */
export function questionScenarios(tag: string): QuestionScenario[] {
  return [
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q1`,
      questions: [
        {
          header: 'Scope',
          question: 'Which screens should change?',
          multiSelect: false,
          options: [option('Wallet only', 'The balance and the list'), option('Every tab')],
        },
      ],
      answers: [{ picks: [1], other: null }],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q2`,
      questions: [
        {
          header: 'Storage',
          question: 'Where should the cache live?',
          multiSelect: false,
          options: [option('Redis'), option('Postgres'), option('Memory')],
        },
      ],
      answers: [{ picks: [], other: 'SQLite on the host' }],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q3`,
      questions: [
        {
          question: 'Ship it today?',
          multiSelect: false,
          options: [option('Yes'), option('No')],
        },
      ],
      answers: [{ picks: [0], other: null }],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q4`,
      questions: [
        {
          header: 'Scope',
          question: 'Which screens should change?',
          multiSelect: false,
          options: [option('Wallet only'), option('Every tab', 'Wallet, Swap and Settings')],
        },
        {
          header: 'Platforms',
          question: 'Which platforms ship it?',
          multiSelect: true,
          options: [option('iOS'), option('Android'), option('Web')],
        },
      ],
      answers: [
        { picks: [0], other: null },
        { picks: [0, 2], other: null },
      ],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q5`,
      questions: [
        {
          header: 'Tests',
          question: 'Which suites must pass?',
          multiSelect: true,
          options: [option('Unit'), option('Integration'), option('E2E')],
        },
        {
          header: 'Release',
          question: 'Which channel?',
          multiSelect: false,
          options: [option('Beta'), option('Stable')],
        },
      ],
      answers: [
        { picks: [1], other: 'Fleet' },
        { picks: [1], other: null },
      ],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q6`,
      questions: [
        {
          header: 'Name',
          question: 'What should the flag be called?',
          multiSelect: false,
          options: [option('wallet_v2'), option('new_wallet')],
        },
        {
          header: 'Owners',
          question: 'Who reviews it?',
          multiSelect: true,
          options: [option('Ana'), option('Ben'), option('Chloé')],
        },
        {
          header: 'When',
          question: 'When does it expire?',
          multiSelect: false,
          options: [option('End of month'), option('End of quarter'), option('Never')],
        },
      ],
      answers: [
        { picks: [], other: 'wallet_empty_state' },
        { picks: [0, 2], other: null },
        { picks: [1], other: null },
      ],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q7`,
      questions: [
        {
          header: 'Copy',
          question: 'What should the empty state say?',
          multiSelect: false,
          options: [option('Nothing here yet'), option('Your wallet is empty')],
        },
        {
          header: 'Art',
          question: 'Which illustration?',
          multiSelect: false,
          options: [option('Coins'), option('Empty box'), option('None')],
        },
        {
          header: 'Actions',
          question: 'Which actions does it offer?',
          multiSelect: true,
          options: [option('Buy'), option('Receive'), option('Learn more')],
        },
        {
          header: 'Track',
          question: 'Should it log a view event?',
          multiSelect: false,
          options: [option('Yes'), option('No')],
        },
      ],
      answers: [
        { picks: [], other: 'Café is closed: no coins yet' },
        { picks: [2], other: null },
        { picks: [0, 1], other: 'Share address' },
        { picks: [0], other: null },
      ],
    },
    {
      kind: 'question',
      toolUseId: `toolu_${tag}_q8`,
      questions: [
        {
          header: 'Branch',
          question: 'Which branch should this land on?',
          multiSelect: false,
          options: [option('main'), option('release/2.4'), option('fix/wallet-empty-state')],
        },
        {
          header: 'Squash',
          question: 'Squash the commits?',
          multiSelect: false,
          options: [option('Squash'), option('Keep them')],
        },
        {
          header: 'Notify',
          question: 'Who should hear about it?',
          multiSelect: true,
          options: [option('#mobile'), option('#releases')],
        },
      ],
      answers: [
        { picks: [2], other: null },
        { picks: [], other: 'Squash all but the first' },
        { picks: [], other: 'nobody' },
      ],
    },
  ];
}

/** Claude Code at work: the spinner line, which the manifest reads as working. */
export const WORKING_SCREEN = '⠹ Thinking… (12s · esc to interrupt)\n';
/** Claude Code at its prompt, nothing happening. */
export const IDLE_SCREEN =
  '\n╭──────────────────────────────╮\n│ >                            │\n╰──────────────────────────────╯\n>\n';
/** Blocked with nothing the runner can read as a decision. */
export const FALLBACK_SCREEN = 'Claude is waiting for your input\n';
