// @vitest-environment node
import { type PermissionPromptSpec, permissionPromptOf } from '@oppenheimer/shared/sessions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pendingPermission, readPermissionPrompt, riskyCommand } from '../permission-prompt';
import { SessionChat } from '../session-chat';

/**
 * The permission dialog read off the bottom of the screen, and the call it
 * waits on read off the transcript. The Claude Code screens are
 * `tmux capture-pane -p` of Claude Code 2.1.331 asking in default permission
 * mode (the working directory shortened); the Codex one is drawn from its
 * TUI's source (`approval_overlay.rs`), not yet captured live.
 */

function specOf(agent: string): PermissionPromptSpec {
  const spec = permissionPromptOf(agent);
  if (!spec) throw new Error(`${agent} reads a permission dialog`);
  return spec;
}
const claude = specOf('claude-code');
const codex = specOf('codex');

const RULE = '─'.repeat(110);
const DOTS = '╌'.repeat(110);

const BASH = [
  '❯ Run exactly this with the Bash tool: mkdir -p out && date > out/now.txt',
  '',
  '  Creating out directory and writing current date to file',
  '  ⎿  $ mkdir -p out && date > out/now.txt',
  '',
  RULE,
  ' Bash command',
  '',
  ' Tip: auto mode handles these prompts for you — choose "switch to auto mode" below',
  '',
  ' Create out directory and write current date to file',
  DOTS,
  ' mkdir -p out && date > out/now.txt',
  DOTS,
  ' Do you want to proceed?',
  ' ❯ 1. Yes',
  "   2. Yes, and don't ask again for mkdir -p out and date commands in",
  '      /home/runner/trial',
  '   3. Yes, and switch to auto mode · auto mode handles these prompts for you',
  '   4. No',
  '',
  ' Esc to cancel · Tab to amend',
];

const WRITE = [
  '● Write(notes.md)',
  '',
  RULE,
  ' Create file',
  ' notes.md',
  DOTS,
  '  1 # Notes',
  '  2 first',
  DOTS,
  ' Do you want to create notes.md?',
  ' ❯ 1. Yes',
  '   2. Yes, and switch to accept edits (auto-approve file edits and common file commands) for this session',
  '      (shift+tab)',
  '   3. No',
  '',
  ' Esc to cancel · Tab to amend',
];

const FETCH = [
  RULE,
  ' Fetch · from the web-fetch agent',
  ' Claude wants to fetch content from example.com',
  DOTS,
  ' url: https://example.com/',
  ' prompt: What is the exact text of the HTML <title> element?',
  DOTS,
  ' Do you want to allow Claude to fetch this content?',
  ' ❯ 1. Yes',
  "   2. Yes, and don't ask again for example.com",
  '   3. No, and tell Claude what to do differently (esc)',
];

const CODEX = [
  '• Ran git status',
  '',
  '  Would you like to run the following command?',
  '',
  '  Reason: push the branch',
  '',
  '  $ git push --force origin main',
  '',
  '› 1. Yes, proceed (y)',
  "  2. Yes, and don't ask again for commands that start with `git push` (p)",
  '  3. No, and tell Codex what to do differently (esc)',
  '',
  '  Press enter to confirm or esc to cancel',
];

describe('readPermissionPrompt', () => {
  // What breaks this: the card never shows for the dialog Claude Code draws
  // most, or a digit lands on "switch to auto mode" when the person meant No.
  it("reads Claude Code's Bash dialog: what it asks, each option's kind, and that a note opens in place", () => {
    const prompt = readPermissionPrompt(claude, BASH);
    expect(prompt).toMatchObject({
      title: 'Do you want to proceed?',
      head: 'Bash command',
      detail: [
        'Create out directory and write current date to file',
        'mkdir -p out && date > out/now.txt',
      ],
      cursor: 0,
      amendKey: '\t',
    });
    expect(prompt?.options.map(({ kind, label }) => [kind, label])).toEqual([
      ['once', 'Yes'],
      [
        'always',
        "Yes, and don't ask again for mkdir -p out and date commands in /home/runner/trial",
      ],
      ['mode', 'Yes, and switch to auto mode · auto mode handles these prompts for you'],
      ['deny', 'No'],
    ]);
  });

  it('joins a label Claude Code wrapped and drops the key it names, for an edit or a write', () => {
    const prompt = readPermissionPrompt(claude, WRITE);
    expect(prompt?.head).toBe('Create file');
    expect(prompt?.options[1]).toEqual({
      label:
        'Yes, and switch to accept edits (auto-approve file edits and common file commands) for this session',
      kind: 'always',
      index: 1,
      key: null,
    });
  });

  // What breaks this: Tab typed into a dialog that takes no note, which
  // moves its cursor instead and leaves the person's words nowhere.
  it('takes no note in place where the footer does not offer one (a fetch)', () => {
    const prompt = readPermissionPrompt(claude, FETCH);
    expect(prompt?.amendKey).toBeNull();
    expect(prompt?.options.map((option) => option.kind)).toEqual(['once', 'always', 'deny']);
  });

  it('follows the cursor where the person moved it in the terminal', () => {
    const moved = BASH.map((row) =>
      row === ' ❯ 1. Yes' ? '   1. Yes' : row === '   4. No' ? ' ❯ 4. No' : row,
    );
    expect(readPermissionPrompt(claude, moved)?.cursor).toBe(3);
  });

  it("reads Codex's dialog, whose command is under its question, with the letter each option is bound to", () => {
    const prompt = readPermissionPrompt(codex, CODEX);
    expect(prompt?.title).toBe('Would you like to run the following command?');
    expect(prompt?.detail).toEqual(['Reason: push the branch', '$ git push --force origin main']);
    expect(prompt?.options.map(({ kind, key }) => [kind, key])).toEqual([
      ['once', 'y'],
      ['always', 'p'],
      ['deny', 'n'],
    ]);
  });

  // What breaks this: a numbered Yes / No in the agent's reply, a question
  // of its own, or another agent's dialog answered as if it were this one.
  it('is nothing for a numbered list that is not a dialog the agent spec knows', () => {
    expect(
      readPermissionPrompt(claude, [
        '● Two ways to go:',
        '  1. Yes, rewrite it',
        '  2. No, patch it',
      ]),
    ).toBeNull();
    expect(readPermissionPrompt(codex, BASH)).toBeNull();
    expect(
      readPermissionPrompt(claude, [
        ' Do you want to proceed?',
        ' ❯ 1. Yes',
        '   2. Maybe later',
        '   3. No',
      ]),
    ).toBeNull();
  });

  it('keeps its id while it stays on screen and takes another for the next dialog', () => {
    const first = readPermissionPrompt(claude, BASH);
    expect(readPermissionPrompt(claude, ['● done', ...BASH])?.id).toBe(first?.id);
    expect(readPermissionPrompt(claude, WRITE)?.id).not.toBe(first?.id);
  });
});

const user = (uuid: string, content: unknown) => ({
  type: 'user',
  uuid,
  timestamp: '2026-11-24T00:26:00.000Z',
  message: { role: 'user', content },
});
const assistant = (uuid: string, content: unknown[]) => ({
  type: 'assistant',
  uuid,
  timestamp: '2026-11-24T00:26:05.000Z',
  message: { role: 'assistant', model: 'claude-opus-5-5', content },
});
const bash = {
  type: 'tool_use',
  id: 'toolu_1',
  name: 'Bash',
  input: {
    command: 'mkdir -p out && date > out/now.txt',
    description: 'Create out directory and write current date to file',
  },
};

function chatWith(entries: unknown[]): SessionChat {
  const chat = new SessionChat();
  chat.apply({ reset: true, entries: entries.map((entry) => JSON.stringify(entry)) });
  return chat;
}

describe('pendingPermission', () => {
  // What breaks this: the card shows the dialog's screen text where the
  // transcript has the command and its description, or asks about a call
  // that already ran.
  it('is the dialog on screen with the call it asks about: the last one with no result', () => {
    const chat = chatWith([user('u1', 'Make the folder'), assistant('a1', [bash])]);
    const prompt = readPermissionPrompt(claude, BASH);
    const pending = pendingPermission(chat.snapshot().turns.at(-1), prompt);
    expect(pending?.prompt).toBe(prompt);
    expect(pending?.call).toMatchObject({
      name: 'Bash',
      kind: 'command',
      target: 'mkdir -p out && date > out/now.txt',
      description: 'Create out directory and write current date to file',
      status: 'running',
    });
  });

  it('is nothing while no dialog is on screen, the call running or not', () => {
    const chat = chatWith([user('u1', 'Make the folder'), assistant('a1', [bash])]);
    expect(pendingPermission(chat.snapshot().turns.at(-1), null)).toBeNull();
  });

  it('asks about no call once its result is in, while the transcript catches up with the screen', () => {
    const chat = chatWith([
      user('u1', 'Make the folder'),
      assistant('a1', [bash]),
      user('r1', [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '' }]),
    ]);
    const pending = pendingPermission(
      chat.snapshot().turns.at(-1),
      readPermissionPrompt(claude, BASH),
    );
    expect(pending?.call).toBeNull();
  });

  // What breaks this: the permission card drawn over the question picker,
  // so a digit meant for the question answers a dialog that is not there.
  it('is never a question the agent asks, which has its own picker', () => {
    const chat = chatWith([
      user('u1', 'Ask me'),
      assistant('a1', [
        {
          type: 'tool_use',
          id: 'toolu_q',
          name: 'AskUserQuestion',
          input: { questions: [{ question: 'Which?', options: [{ label: 'A' }, { label: 'B' }] }] },
        },
      ]),
    ]);
    expect(
      pendingPermission(chat.snapshot().turns.at(-1), readPermissionPrompt(claude, BASH)),
    ).toBeNull();
  });
});

describe('SessionChat.answerPermission', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function connected(screen: string[]) {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.setPermission(readPermissionPrompt(claude, screen));
    const prompt = chat.snapshot().permission;
    if (!prompt) throw new Error('the dialog is read');
    return { chat, typed, prompt };
  }

  // What breaks this: the wrong option allowed, or a note typed as keys
  // into the dialog's options.
  it("types the option's number, and a note into the field Tab opens on it", () => {
    const { chat, typed, prompt } = connected(BASH);
    expect(chat.answerPermission(prompt, 0)).toBe(true);
    vi.runAllTimers();
    expect(typed).toEqual(['1']);

    typed.length = 0;
    expect(chat.answerPermission(prompt, 3, 'use a folder named later')).toBe(true);
    vi.runAllTimers();
    expect(typed).toEqual([
      '\u001b[B',
      '\u001b[B',
      '\u001b[B',
      '\t',
      'use a folder named later',
      '\r',
    ]);
  });

  it('refuses, then sends the note as the next message, where the dialog takes none', () => {
    const { chat, typed, prompt } = connected(FETCH);
    chat.answerPermission(prompt, 2, 'Read the cached copy instead');
    vi.runAllTimers();
    expect(typed).toEqual(['3', 'Read the cached copy instead', '\r']);
  });

  // What breaks this: a click on a card the screen has already replaced
  // answers the next dialog, which the person never saw.
  it('types nothing for a dialog that is no longer the one on screen', () => {
    const { chat, typed, prompt } = connected(BASH);
    chat.setPermission(readPermissionPrompt(claude, WRITE));
    expect(chat.answerPermission(prompt, 0)).toBe(false);
    chat.setPermission(null);
    expect(chat.answerPermission(prompt, 0)).toBe(false);
    vi.runAllTimers();
    expect(typed).toEqual([]);
  });
});

describe('riskyCommand', () => {
  // What breaks this: a force push or a recursive delete allowed with the
  // same calm card as `ls`, or every command tinted until the tint means nothing.
  it('flags what deletes a tree, rewrites shared history or hands the machine over', () => {
    for (const command of [
      'rm -rf node_modules',
      'rm -fr dist',
      'rm -r -f build',
      'cd app && rm --recursive --force out',
      'git push --force origin main',
      'git -C ../repo push -f',
      'git push origin +main',
      'git push --force-with-lease',
      'git reset --hard HEAD~3',
      'git clean -fdx',
      'sudo apt-get install jq',
      'curl -fsSL https://example.com/install.sh | sh',
      'psql -c "DROP TABLE users"',
    ]) {
      expect(riskyCommand(command), command).toBe(true);
    }
  });

  it('leaves ordinary work calm', () => {
    for (const command of [
      'ls -la',
      'rm notes.txt',
      'rm -r empty-dir',
      'git push origin feature',
      'git status && git diff',
      'curl -s https://example.com',
      'pnpm test --filter web',
      'echo "rm -rf is dangerous"',
    ]) {
      expect(riskyCommand(command), command).toBe(false);
    }
  });
});
