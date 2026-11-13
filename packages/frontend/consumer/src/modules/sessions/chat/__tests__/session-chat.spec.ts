import { describe, expect, it, vi } from 'vitest';
import { type ChatStep, classify, SessionChat, toTurns } from '../session-chat';

/**
 * The chat view's reading of a Claude Code transcript: prompts open turns,
 * tool calls are classified and paired with their results, the CLI's own
 * lines stay out, and a reset starts over. The entries are the runner's
 * compacted lines (`claude_chat.go`), in Claude Code's own names.
 */

const user = (uuid: string, content: unknown, extra: Record<string, unknown> = {}) => ({
  type: 'user',
  uuid,
  timestamp: '2026-10-21T09:00:00.000Z',
  message: { role: 'user', content },
  ...extra,
});

const assistant = (uuid: string, content: unknown[], at = '2026-10-21T09:00:30.000Z') => ({
  type: 'assistant',
  uuid,
  timestamp: at,
  message: { role: 'assistant', model: 'claude-opus-5-5', content },
});

const kinds = (steps: ChatStep[]) =>
  steps.map((step) => (step.kind === 'tool' ? `${step.kind}:${step.call.kind}` : step.kind));

describe('toTurns', () => {
  it('opens a turn at each prompt and settles it on a reply', () => {
    const turns = toTurns([
      user('u1', 'Fix the flaky test'),
      assistant('a1', [{ type: 'thinking', thinking: 'Look at the spec first.' }]),
      assistant('a2', [
        {
          type: 'tool_use',
          id: 't1',
          name: 'Bash',
          input: { command: 'pnpm test', description: 'Run tests' },
        },
      ]),
      user('r1', [{ type: 'tool_result', tool_use_id: 't1', content: '1 failed', is_error: true }]),
      assistant(
        'a3',
        [{ type: 'text', text: 'It was a race. **Fixed.**' }],
        '2026-10-21T09:01:13.000Z',
      ),
      user('u2', [{ type: 'text', text: 'Now ship it' }, { type: 'image' }]),
    ]);

    expect(turns).toHaveLength(2);
    const [first, second] = turns;
    expect(first?.prompt?.text).toBe('Fix the flaky test');
    expect(kinds(first?.steps ?? [])).toEqual(['thinking', 'tool:command', 'reply']);
    expect(first?.model).toBe('claude-opus-5-5');
    expect(first?.working).toBe(false);
    expect(first?.lastAt?.toISOString()).toBe('2026-10-21T09:01:13.000Z');
    const call = first?.steps[1];
    expect(call?.kind === 'tool' && call.call).toMatchObject({
      target: 'pnpm test',
      description: 'Run tests',
      status: 'failed',
      output: '1 failed',
    });
    // The last prompt has no answer yet: the agent is on it.
    expect(second?.prompt).toMatchObject({ text: 'Now ship it', files: 1 });
    expect(second?.working).toBe(true);
  });

  it("shows the previews the host sent of a prompt's images and a result's, as data URLs", () => {
    const jpeg = { type: 'base64', media_type: 'image/jpeg', data: '/9j/4AAQSkZJRg==' };
    const turns = toTurns([
      user('u1', [
        { type: 'text', text: 'Match this' },
        { type: 'image', source: jpeg },
        // Only named: no room on the link, or a host from before previews.
        { type: 'image' },
        // Never drawn: a type an img could run, or bytes that are not base64.
        { type: 'image', source: { ...jpeg, media_type: 'image/svg+xml' } },
        { type: 'image', source: { ...jpeg, data: 'not base64"><script>' } },
      ]),
      assistant('a1', [
        { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/tmp/shot.png' } },
      ]),
      user('r1', [
        {
          type: 'tool_result',
          tool_use_id: 't1',
          content: '[image]',
          images: [{ source: jpeg }, {}],
        },
      ]),
    ]);

    expect(turns[0]?.prompt?.files).toBe(4);
    expect(turns[0]?.prompt?.images).toEqual([
      { src: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
      { src: null },
      { src: null },
      { src: null },
    ]);
    const read = turns[0]?.steps[0];
    expect(read?.kind === 'tool' && read.call.images).toEqual([
      { src: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
      { src: null },
    ]);
  });

  it('keeps a call running until its result lands, and the turn with it', () => {
    const turns = toTurns([
      user('u1', 'Read it'),
      assistant('a1', [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.ts' } }]),
    ]);
    const step = turns[0]?.steps[0];
    expect(step?.kind === 'tool' && step.call.status).toBe('running');
    expect(turns[0]?.working).toBe(true);
  });

  it('counts the lines an edit changes, and reads todos and plans as their own cards', () => {
    const turns = toTurns([
      user('u1', 'Go'),
      assistant('a1', [
        {
          type: 'tool_use',
          id: 'e',
          name: 'MultiEdit',
          input: {
            file_path: 'a.ts',
            edits: [
              { old_string: 'a\nb', new_string: 'a\nb\nc' },
              { old_string: 'x', new_string: 'y' },
            ],
          },
        },
        {
          type: 'tool_use',
          id: 'w',
          name: 'Write',
          input: { file_path: 'b.ts', content: '1\n2\n' },
        },
        {
          type: 'tool_use',
          id: 'todo',
          name: 'TodoWrite',
          input: {
            todos: [
              { content: 'Read', status: 'completed' },
              { content: 'Fix', status: 'in_progress' },
              { content: '', status: 'pending' },
            ],
          },
        },
        { type: 'tool_use', id: 'p', name: 'ExitPlanMode', input: { plan: '1. Do it' } },
        { type: 'tool_use', id: 'm', name: 'mcp__github__get_issue', input: {} },
      ]),
    ]);
    const calls = (turns[0]?.steps ?? []).flatMap((step) =>
      step.kind === 'tool' ? [step.call] : [],
    );
    expect(calls.map((call) => call.kind)).toEqual(['edit', 'write', 'todo', 'plan', 'mcp']);
    expect(calls[0]?.diff).toEqual({ additions: 4, deletions: 3 });
    expect(calls[1]?.diff).toEqual({ additions: 2, deletions: 0 });
    // What breaks this: the chat's file viewer has nothing to show once a
    // call keeps the counts and drops the text they were counted off.
    expect(calls[0]?.edits).toEqual([
      { before: 'a\nb', after: 'a\nb\nc' },
      { before: 'x', after: 'y' },
    ]);
    expect(calls[1]?.edits).toEqual([{ before: '', after: '1\n2\n' }]);
    expect(calls[2]?.todos).toEqual([
      { text: 'Read', status: 'completed' },
      { text: 'Fix', status: 'in_progress' },
    ]);
    expect(calls[3]?.plan).toBe('1. Do it');
  });

  it('reads the questions a call asks and, once answered, the answers out of its result', () => {
    const ask = (id: string) => ({
      type: 'tool_use',
      id,
      name: 'AskUserQuestion',
      input: {
        questions: [
          {
            header: 'Scope',
            question: 'What should the design system cover?',
            multiSelect: false,
            options: [
              { label: 'Tokens only', description: 'Colours, type, radii' },
              { label: 'Everything' },
            ],
          },
          { question: 'Which platforms?', multiSelect: true, options: [{ label: 'Web' }] },
          { header: 'Empty', options: [] },
        ],
      },
    });
    // Claude Code's own words for the two outcomes, as its transcript keeps them.
    const turns = toTurns([
      user('u1', 'Set it up'),
      assistant('a1', [ask('q1'), ask('q2')]),
      user('r1', [
        {
          type: 'tool_result',
          tool_use_id: 'q1',
          content:
            'Your questions have been answered: "What should the design system cover?"="Everything", "Which platforms?"="Web, Linux". You can now continue with these answers in mind.',
        },
        {
          type: 'tool_result',
          tool_use_id: 'q2',
          is_error: true,
          content: "The user doesn't want to proceed with this tool use.",
        },
      ]),
    ]);
    const [answered, declined] = (turns[0]?.steps ?? []).flatMap((step) =>
      step.kind === 'tool' ? [step.call] : [],
    );
    expect(answered?.kind).toBe('question');
    expect(answered?.questions).toEqual([
      {
        header: 'Scope',
        question: 'What should the design system cover?',
        multiSelect: false,
        options: [
          { label: 'Tokens only', description: 'Colours, type, radii' },
          { label: 'Everything', description: null },
        ],
      },
      {
        header: null,
        question: 'Which platforms?',
        multiSelect: true,
        options: [{ label: 'Web', description: null }],
      },
    ]);
    expect(answered?.answers).toEqual({
      'What should the design system cover?': 'Everything',
      'Which platforms?': 'Web, Linux',
    });
    expect(declined?.status).toBe('failed');
    expect(declined?.answers).toBeNull();
  });

  it("leaves out the CLI's own lines and subagents, and reads a slash command as typed", () => {
    const turns = toTurns([
      user(
        'c',
        'Caveat: The messages below were generated by the user while running local commands.',
        {
          isMeta: true,
        },
      ),
      user('m', '<command-name>/review</command-name>\n<command-args>142</command-args>'),
      user('o', '<local-command-stdout></local-command-stdout>'),
      { ...assistant('s', [{ type: 'text', text: 'subagent' }]), isSidechain: true },
      { type: 'attachment', attachment: {} },
      'not an object',
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.prompt?.text).toBe('/review 142');
    expect(turns[0]?.steps).toEqual([]);
  });

  it('reads pasted text without the tags the CLI wraps it in', () => {
    const turns = toTurns([
      user(
        'p',
        'Here it is:\n<pasted_content id="0ef4">\nStep 1, api.env\n</pasted_content>\nThoughts?',
      ),
    ]);
    expect(turns[0]?.prompt?.text).toBe('Here it is:\n\nStep 1, api.env\n\nThoughts?');
  });

  it('keeps a paste that starts like one of the CLI lines as the prompt', () => {
    const turns = toTurns([
      user('p', '<pasted_content id="x">Caveat: a sample log</pasted_content>\nExplain this.'),
    ]);
    expect(turns[0]?.prompt?.text).toBe('Caveat: a sample log\nExplain this.');
  });

  it('leaves out the system reminders the CLI puts before or after the words', () => {
    const reminder = '<system-reminder>\nThe date changed.\n</system-reminder>';
    const text = (value: string) => ({ type: 'text', text: value });
    const turns = toTurns([
      user('a', [text(reminder), text('Fix the picker')]),
      user('b', [text('Fix the list'), text(reminder)]),
      user('c', `Fix the menu\n\n${reminder}`),
      user('d', reminder),
    ]);
    expect(turns.map((turn) => turn.prompt?.text)).toEqual([
      'Fix the picker',
      'Fix the list',
      'Fix the menu',
    ]);
  });

  it("reads the CLI's own lines as before when a reminder comes first", () => {
    const reminder = '<system-reminder>r</system-reminder>';
    const text = (value: string) => ({ type: 'text', text: value });
    const turns = toTurns([
      user('u1', 'Go'),
      assistant('a1', [{ type: 'text', text: 'Starting' }]),
      user('i', [text(reminder), text('[Request interrupted by user]')]),
      user('t', [
        text(reminder),
        text(
          '<task-notification>\n<status>completed</status>\n<summary>Done</summary>\n</task-notification>',
        ),
      ]),
    ]);
    expect(turns).toHaveLength(1);
    expect(kinds(turns[0]?.steps ?? [])).toEqual(['reply', 'notice', 'task']);
  });

  it('keeps a reminder quoted inside a paste', () => {
    const turns = toTurns([
      user(
        'p',
        '<pasted_content id="x">log: <system-reminder>r</system-reminder></pasted_content>\nWhy?',
      ),
    ]);
    expect(turns[0]?.prompt?.text).toBe('log: <system-reminder>r</system-reminder>\nWhy?');
  });

  it('marks an interrupted turn and a compaction where they happened', () => {
    const turns = toTurns([
      user('u1', 'Go'),
      assistant('a1', [{ type: 'text', text: 'Starting' }]),
      user('i', [{ type: 'text', text: '[Request interrupted by user]' }]),
      user('k', 'This session is being continued…', { isCompactSummary: true }),
    ]);
    expect(kinds(turns[0]?.steps ?? [])).toEqual(['reply', 'notice', 'notice']);
    expect(turns[0]?.working).toBe(false);
  });

  it("reads a background task's end as a step of the turn, not a prompt", () => {
    const turns = toTurns([
      user('u1', 'Merge it once CI is green'),
      assistant('a1', [{ type: 'text', text: 'Waiting in the background.' }]),
      user(
        'n',
        '<task-notification>\n<task-id>bpnz5h6eb</task-id>\n<output-file>/tmp/x.output</output-file>\n<status>completed</status>\n<summary>Background command "Wait for CI" completed (exit code 0)</summary>\n</task-notification>',
      ),
      user('f', [
        {
          type: 'text',
          text: '<task-notification><status>failed</status></task-notification>',
        },
      ]),
      assistant('a2', [{ type: 'text', text: 'Merged.' }]),
    ]);
    expect(turns).toHaveLength(1);
    const steps = turns[0]?.steps ?? [];
    expect(kinds(steps)).toEqual(['reply', 'task', 'task', 'reply']);
    expect(steps[1]).toMatchObject({
      status: 'completed',
      summary: 'Background command "Wait for CI" completed (exit code 0)',
    });
    expect(steps[2]).toMatchObject({ status: 'failed', summary: null });
  });

  it('never reads a status it does not know as a success', () => {
    const [turn] = toTurns([
      user('u1', 'Go'),
      user('n', '<task-notification><status>paused</status></task-notification>'),
    ]);
    expect(turn?.steps[0]).toMatchObject({ kind: 'task', status: 'unknown' });
  });

  it('is working again when a task wakes the agent after a command the CLI answered', () => {
    const turns = toTurns([
      user('c', '<command-name>/cost</command-name>\n<command-args></command-args>'),
      user('o', '<local-command-stdout>Total cost: $0.42</local-command-stdout>'),
      user('n', '<task-notification><status>completed</status></task-notification>'),
      assistant('a1', [
        { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'gh pr merge' } },
      ]),
    ]);
    expect(turns).toHaveLength(1);
    expect(kinds(turns[0]?.steps ?? [])).toEqual(['output', 'task', 'tool:command']);
    expect(turns[0]?.working).toBe(true);
  });

  // Regression: `/context` showed its prompt and nothing under it, because
  // the CLI's answer only settled the turn and its text was dropped.
  it("shows what a command the CLI answered printed, without the terminal's colours", () => {
    const [turn] = toTurns([
      user('c', '<command-name>/context</command-name>\n<command-args></command-args>'),
      user(
        'o',
        '<local-command-stdout>\u001b[1mContext Usage\u001b[22m\r\n\u001b[38;2;136;136;136m⛁ ⛀ \u001b[39m\u001b[38;2;153;153;153mOpus 5.5\u001b[39m\n  ⛶ ⛶   118.6k/1m tokens (12%)\n</local-command-stdout>',
      ),
    ]);
    expect(turn?.prompt?.text).toBe('/context');
    expect(turn?.working).toBe(false);
    expect(turn?.steps).toEqual([
      {
        kind: 'output',
        id: 'o',
        at: new Date('2026-10-21T09:00:00.000Z'),
        text: 'Context Usage\n⛁ ⛀ Opus 5.5\n  ⛶ ⛶   118.6k/1m tokens (12%)',
        failed: false,
      },
    ]);
  });

  it('reads what a command wrote to stderr as a failed output', () => {
    const [turn] = toTurns([
      user('c', '<command-name>/model</command-name>\n<command-args>nope</command-args>'),
      user('o', '<local-command-stderr>Unknown model: nope</local-command-stderr>'),
    ]);
    expect(turn?.steps[0]).toMatchObject({
      kind: 'output',
      text: 'Unknown model: nope',
      failed: true,
    });
  });
});

describe('SessionChat', () => {
  it('starts over on a reset and tells its readers each time', () => {
    const chat = new SessionChat();
    const listener = vi.fn();
    chat.subscribe(listener);
    expect(chat.snapshot().available).toBe(false);

    chat.apply({ reset: true, entries: [JSON.stringify(user('u1', 'One'))] });
    chat.apply({ entries: [JSON.stringify(user('u2', 'Two')), '{not json'] });
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual(['One', 'Two']);

    const before = chat.snapshot();
    chat.apply({ reset: true, entries: [] });
    expect(chat.snapshot()).toEqual({
      available: true,
      loading: false,
      turns: [],
      queued: [],
      status: null,
      files: [],
      older: 'none',
      activity: null,
      interruptible: true,
    });
    expect(before.turns).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('draws a long first load once, when its history has all come', () => {
    // What breaks this: each part of a long history drawn as it lands, so the
    // chat's window runs through the whole conversation on a first load,
    // mounting every turn on its way to the end.
    const lines = Array.from({ length: 300 }, (_, i) =>
      JSON.stringify(user(`u${i}`, `Prompt ${i}`)),
    );
    const chat = new SessionChat();
    const seen: number[] = [];
    chat.subscribe(() => seen.push(chat.snapshot().turns.length));

    // The runner's full batch, then the short one that ends its read: which
    // could be any read of a longer transcript, so only the quiet ends it.
    vi.useFakeTimers();
    chat.apply({ reset: true, entries: lines.slice(0, 256) });
    expect(chat.snapshot()).toMatchObject({ available: true, loading: true, turns: [] });
    chat.apply({ entries: lines.slice(256) });
    expect(chat.snapshot()).toMatchObject({ loading: true, turns: [] });
    vi.advanceTimersByTime(1_000);
    expect(chat.snapshot().loading).toBe(false);
    expect(chat.snapshot().turns).toHaveLength(300);
    expect(seen).toEqual([0, 300]);
    vi.useRealTimers();
  });

  it('draws a first load whose history goes quiet before a short batch', () => {
    // What breaks this: a history that ends on a full batch, never drawn.
    vi.useFakeTimers();
    const lines = Array.from({ length: 256 }, (_, i) =>
      JSON.stringify(user(`u${i}`, `Prompt ${i}`)),
    );
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: lines });
    expect(chat.snapshot().turns).toHaveLength(0);
    vi.advanceTimersByTime(1_000);
    expect(chat.snapshot()).toMatchObject({ loading: false });
    expect(chat.snapshot().turns).toHaveLength(256);
    vi.useRealTimers();
  });

  it('keeps holding a first load whose short-looking batch is full in UTF-8', () => {
    // What breaks this: a batch measured in UTF-16 units, so one the runner
    // closed at its byte limit, heavy in CJK text, reads as the end of the
    // history and each part of the rest is drawn as it lands.
    vi.useFakeTimers();
    const text = '漢'.repeat(14_000);
    const lines = [0, 1, 2].map((i) => JSON.stringify(user(`u${i}`, `${text} ${i}`)));
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: lines });
    expect(chat.snapshot()).toMatchObject({ loading: true, turns: [] });
    vi.advanceTimersByTime(1_000);
    expect(chat.snapshot().turns).toHaveLength(3);
    vi.useRealTimers();
  });

  it('settles a replay that came back short while a first load was held', () => {
    // What breaks this: a first load's quiet that ends the hold but not the
    // replay a reconnect started under it, so turns the transcript no longer
    // has stay drawn.
    vi.useFakeTimers();
    const lines = Array.from({ length: 512 }, (_, i) =>
      JSON.stringify(user(`u${i}`, `Prompt ${i}`)),
    );
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: lines.slice(0, 256) });
    chat.apply({ entries: lines.slice(256) });
    // The link drops; the reconnect sends back only the first full batch.
    chat.apply({ reset: true, entries: lines.slice(0, 256) });
    vi.advanceTimersByTime(10_000);
    expect(chat.snapshot().loading).toBe(false);
    expect(chat.snapshot().turns).toHaveLength(256);
    vi.useRealTimers();
  });

  it('keeps holding a long first load past the short batch that ends one of its reads', () => {
    // What breaks this: a short batch taken as the end of any history. The
    // runner reads a long transcript 4MB at a time and ends each read on a
    // short batch, so the chat drew the first read's turns and then slid
    // through the rest of the conversation as the later reads landed.
    vi.useFakeTimers();
    const answer = 'The reducer folds every entry into the running total. '.repeat(40);
    const line = (i: number) =>
      JSON.stringify(assistant(`a${i}`, [{ type: 'text', text: `${answer} ${i}` }]));
    const prompt = (i: number) => JSON.stringify(user(`u${i}`, `Prompt ${i}`));
    const history = Array.from({ length: 1_000 }, (_, i) => [prompt(i), line(i)]).flat();
    const chat = new SessionChat();
    // The first read: full batches, then the short one it ends on.
    chat.apply({ reset: true, entries: history.slice(0, 256) });
    for (let at = 256; at < 1_536; at += 256) chat.apply({ entries: history.slice(at, at + 256) });
    chat.apply({ entries: history.slice(1_536, 1_556) });
    expect(chat.snapshot()).toMatchObject({ loading: true, turns: [] });
    // The next read, 300ms later.
    vi.advanceTimersByTime(300);
    chat.apply({ entries: history.slice(1_556) });
    expect(chat.snapshot()).toMatchObject({ loading: true, turns: [] });
    vi.advanceTimersByTime(1_000);
    expect(chat.snapshot().turns).toHaveLength(1_000);
    vi.useRealTimers();
  });

  it('draws a short first load at once', () => {
    // What breaks this: every chat held for the quiet, a short one too.
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: [JSON.stringify(user('u1', 'One'))] });
    expect(chat.snapshot()).toMatchObject({ loading: false });
    expect(chat.snapshot().turns).toHaveLength(1);
  });

  it('holds a first load its runner says is still coming, past any pause, until it says the end', () => {
    // What breaks this: a first load let go on the size or the pace of its
    // batches. A runner making previews of a read's screenshots sends a
    // short first batch, then pauses past any quiet the chat could wait out,
    // so a chat full of images was drawn once per read on its way down.
    vi.useFakeTimers();
    const lines = Array.from({ length: 30 }, (_, i) =>
      JSON.stringify(user(`u${i}`, `Prompt ${i}`)),
    );
    const chat = new SessionChat();
    const seen: number[] = [];
    chat.subscribe(() => seen.push(chat.snapshot().turns.length));
    chat.apply({ reset: true, history: 'more', entries: lines.slice(0, 3) });
    vi.advanceTimersByTime(2_000);
    chat.apply({ history: 'more', entries: lines.slice(3, 20) });
    vi.advanceTimersByTime(2_000);
    expect(chat.snapshot()).toMatchObject({ loading: true, turns: [] });
    chat.apply({ history: 'end', entries: lines.slice(20) });
    expect(chat.snapshot()).toMatchObject({ loading: false });
    expect(seen).toEqual([0, 30]);
    vi.useRealTimers();
  });

  it('draws a long first load the moment its runner says the history ended', () => {
    // What breaks this: a runner's end ignored, so a full last batch waits
    // out a quiet before anything is drawn.
    const lines = Array.from({ length: 256 }, (_, i) =>
      JSON.stringify(user(`u${i}`, `Prompt ${i}`)),
    );
    const chat = new SessionChat();
    chat.apply({ reset: true, history: 'end', entries: lines });
    expect(chat.snapshot()).toMatchObject({ loading: false });
    expect(chat.snapshot().turns).toHaveLength(256);
  });

  it('keeps what is drawn when a reconnect starts its replay with no lines yet', () => {
    // What breaks this: a reset with no lines taken as a transcript that is
    // empty now, when its runner says the history is still coming (a read
    // that ended inside a screenshot's line), so the chat blanks and is
    // drawn again from the top.
    const lines = [user('u1', 'One'), user('u2', 'Two')].map((entry) => JSON.stringify(entry));
    const chat = new SessionChat();
    chat.apply({ reset: true, history: 'end', entries: lines });
    const before = chat.snapshot();
    chat.apply({ reset: true, history: 'more', entries: [] });
    chat.apply({ history: 'end', entries: lines });
    expect(chat.snapshot().turns).toBe(before.turns);
  });

  it('drops what a replay did not send again as soon as its runner says the history ended', () => {
    // What breaks this: a replay that came back short kept on screen for
    // the quiet, when the runner has said there is no more.
    const lines = [user('u1', 'One'), user('u2', 'Two'), user('u3', 'Three')].map((entry) =>
      JSON.stringify(entry),
    );
    const chat = new SessionChat();
    chat.apply({ reset: true, history: 'end', entries: lines });
    chat.apply({ reset: true, history: 'end', entries: lines.slice(0, 2) });
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual(['One', 'Two']);
  });

  it('keeps a long conversation drawn while a reconnect replays it, and takes what is new after', () => {
    // What breaks this: a reset that empties the chat and refills it batch by
    // batch, so a long chat on screen collapses to its first turns, every
    // turn is drawn afresh and the reader loses their place on each reconnect.
    const lines = [
      user('u1', 'One'),
      assistant('a1', [{ type: 'text', text: 'Hi.' }]),
      user('u2', 'Two'),
      assistant('a2', [{ type: 'text', text: 'Sure.' }]),
      user('u3', 'Three'),
    ].map((entry) => JSON.stringify(entry));
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: lines });
    const before = chat.snapshot();
    const listener = vi.fn();
    chat.subscribe(listener);

    // The history comes back in parts, the first under the reset.
    chat.apply({ reset: true, entries: lines.slice(0, 2) });
    chat.apply({ entries: lines.slice(2) });
    expect(chat.snapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();

    const next = JSON.stringify(assistant('a3', [{ type: 'text', text: 'Done.' }]));
    chat.apply({ entries: [next] });
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual(['One', 'Two', 'Three']);
    expect(chat.snapshot().turns[0]).toBe(before.turns[0]);
    expect(chat.snapshot().turns.at(-1)?.working).toBe(false);
  });

  it('builds again from the first line a reset sends that the chat does not hold', () => {
    // What breaks this: a replay taken on trust, so a transcript the CLI
    // rewrote keeps the turns it no longer has.
    const one = JSON.stringify(user('u1', 'One'));
    const hi = JSON.stringify(assistant('a1', [{ type: 'text', text: 'Hi.' }]));
    const chat = new SessionChat();
    chat.apply({
      reset: true,
      entries: [one, hi, JSON.stringify(user('u2', 'Two')), JSON.stringify(user('u3', 'Three'))],
    });
    chat.apply({ reset: true, entries: [one, hi, JSON.stringify(user('u9', 'Other'))] });
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual(['One', 'Other']);
  });

  it('drops what a replay that went quiet did not send again', () => {
    // What breaks this: a replay that only ever cuts on a line that differs,
    // so a transcript the CLI shortened keeps its old turns on screen.
    vi.useFakeTimers();
    const lines = [user('u1', 'One'), user('u2', 'Two'), user('u3', 'Three')].map((entry) =>
      JSON.stringify(entry),
    );
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: lines });
    chat.apply({ reset: true, entries: lines.slice(0, 2) });
    expect(chat.snapshot().turns).toHaveLength(3);
    vi.advanceTimersByTime(5_000);
    expect(chat.snapshot().turns.map((turn) => turn.prompt?.text)).toEqual(['One', 'Two']);
    vi.useRealTimers();
  });

  it('opens a closed turn again when a replay cuts the late result it took', () => {
    // What breaks this: a cut that rebuilds only from the turn it falls in,
    // so an earlier turn keeps a call finished by a line that is gone.
    const one = JSON.stringify(user('u1', 'One'));
    const call = JSON.stringify(
      assistant('a1', [
        { type: 'tool_use', id: 'bg', name: 'Bash', input: { command: 'pnpm dev' } },
      ]),
    );
    const started = JSON.stringify(assistant('a2', [{ type: 'text', text: 'Started.' }]));
    const two = JSON.stringify(user('u2', 'Two'));
    const result = JSON.stringify(
      user('r1', [{ type: 'tool_result', tool_use_id: 'bg', content: 'stopped' }]),
    );
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: [one, call, started, two, result] });
    const bg = () => {
      const step = chat.snapshot().turns[0]?.steps[0];
      return step?.kind === 'tool' ? step.call.status : null;
    };
    expect(bg()).toBe('done');

    chat.apply({
      reset: true,
      entries: [
        one,
        call,
        started,
        two,
        JSON.stringify(assistant('a3', [{ type: 'text', text: 'Hi.' }])),
      ],
    });
    expect(bg()).toBe('running');
  });

  it('reads a long conversation line by line as the whole transcript reads, keeping closed turns', () => {
    const entries = [
      user('u1', 'One'),
      assistant('a1', [
        { type: 'tool_use', id: 'bg', name: 'Bash', input: { command: 'pnpm dev' } },
      ]),
      assistant('a2', [{ type: 'text', text: 'Started it.' }]),
      user('u2', 'Two'),
      assistant('a3', [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: 'a.ts' } }]),
      user('r2', [{ type: 'tool_result', tool_use_id: 't2', content: 'code' }]),
      assistant('a4', [{ type: 'text', text: 'Read it.' }]),
      user('u3', 'Three'),
      // The first turn's command ends while the third turn runs.
      user('r1', [{ type: 'tool_result', tool_use_id: 'bg', content: 'stopped', is_error: true }]),
      assistant('a5', [{ type: 'text', text: 'Done.' }]),
    ];
    const chat = new SessionChat();
    const seen: ReturnType<SessionChat['snapshot']>[] = [];
    for (const entry of entries) {
      chat.apply({ entries: [JSON.stringify(entry)] });
      seen.push(chat.snapshot());
    }

    expect(chat.snapshot().turns).toEqual(toTurns(entries));
    // A closed turn is the same object while later lines go to the open one.
    expect(seen[6]?.turns[0]).toBe(seen[4]?.turns[0]);
    expect(seen[9]?.turns[1]).toBe(seen[8]?.turns[1]);
    // A result for a closed turn's call still lands on it.
    const first = chat.snapshot().turns[0]?.steps[0];
    expect(first?.kind === 'tool' && first.call.status).toBe('failed');
  });

  it('builds again from the turn a late result lands on, keeping the turns before it', () => {
    // What breaks this: a late result that rebuilds the whole conversation
    // (every turn a new object, a long chat's every line redrawn), or one
    // that rebuilds from the wrong turn and loses the result or a turn.
    const entries = [
      user('u1', 'One'),
      assistant('a1', [{ type: 'text', text: 'Hi.' }]),
      user('u2', 'Two'),
      assistant('a2', [
        { type: 'tool_use', id: 'bg', name: 'Bash', input: { command: 'pnpm build' } },
      ]),
      assistant('a3', [{ type: 'text', text: 'Building.' }]),
      user('u3', 'Three'),
      assistant('a4', [{ type: 'text', text: 'Sure.' }]),
      user('u4', 'Four'),
      // The second turn's build ends while the fourth turn runs.
      user('r1', [{ type: 'tool_result', tool_use_id: 'bg', content: 'built' }]),
    ];
    const chat = new SessionChat();
    chat.apply({ entries: entries.slice(0, -1).map((entry) => JSON.stringify(entry)) });
    const before = chat.snapshot().turns;
    chat.apply({ entries: [JSON.stringify(entries.at(-1))] });
    const after = chat.snapshot().turns;

    expect(after).toEqual(toTurns(entries));
    expect(after[0]).toBe(before[0]);
    const build = after[1]?.steps[0];
    expect(build?.kind === 'tool' && build.call.status).toBe('done');
  });
});

describe('classify', () => {
  it("reads one entry on its own: a prompt, the agent's steps, results, or nothing", () => {
    expect(classify(user('u', 'Go'), 0)).toMatchObject({ kind: 'prompt', prompt: { text: 'Go' } });
    expect(
      classify(
        assistant('a', [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: 'Hi' },
        ]),
        1,
      ),
    ).toMatchObject({
      kind: 'steps',
      model: 'claude-opus-5-5',
      steps: [{ kind: 'reply', id: 'a:1' }],
    });
    expect(
      classify(user('r', [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }]), 2),
    ).toMatchObject({
      kind: 'results',
      results: [{ toolUseId: 't', failed: false, output: 'ok' }],
    });
    expect(classify({ type: 'file-history-snapshot' }, 3)).toBeNull();
  });

  it('stamps each step and each call with when it happened', () => {
    const [turn] = toTurns([
      user('u', 'Go'),
      assistant(
        'a',
        [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'ls' } }],
        '2026-10-21T09:00:05.000Z',
      ),
      {
        ...user('r', [{ type: 'tool_result', tool_use_id: 't', content: 'a' }]),
        timestamp: '2026-10-21T09:00:09.000Z',
      },
    ]);
    const step = turn?.steps[0];
    expect(step?.at?.toISOString()).toBe('2026-10-21T09:00:05.000Z');
    expect(step?.kind === 'tool' && step.call.finishedAt?.toISOString()).toBe(
      '2026-10-21T09:00:09.000Z',
    );
  });
});

describe('typing into the session', () => {
  it('types a line as it is and several as one paste, then Enter, and stops with Escape', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.send('nobody is connected yet');
    const release = chat.connect((data) => typed.push(data));
    chat.send('Now ship it');
    vi.runAllTimers();
    chat.send('One\nTwo');
    vi.runAllTimers();
    chat.send('   ');
    chat.interrupt();
    release();
    chat.interrupt();
    expect(typed).toEqual(['Now ship it', '\r', '\u001b[200~One\nTwo\u001b[201~', '\r', '\u001b']);
    vi.useRealTimers();
  });

  it('answers a question with the picker’s keys, one at a time, and with nothing before it connects', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    const question = {
      header: null,
      question: 'Which?',
      multiSelect: false,
      options: [{ label: 'A', description: null }],
    };
    expect(chat.answer([question], [{ picks: [0], other: null }])).toBe(false);
    chat.connect((data) => typed.push(data));
    expect(chat.answer([question], [{ picks: [], other: 'Mine' }])).toBe(true);
    vi.advanceTimersByTime(0);
    expect(typed).toEqual(['2']);
    vi.advanceTimersByTime(120);
    expect(typed).toEqual(['2', 'Mine']);
    vi.runAllTimers();
    expect(typed).toEqual(['2', 'Mine', '\r']);
    vi.useRealTimers();
  });

  it('sends files already in the prompt with Enter alone, or with words', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.send('', { withFiles: true });
    vi.runAllTimers();
    chat.send('What is in these?', { withFiles: true });
    vi.runAllTimers();
    expect(typed).toEqual(['\r', 'What is in these?', '\r']);
    vi.useRealTimers();
  });
});

describe('what the context holds', () => {
  it('reads what the last answer in each turn was sent, and none from a host that sends no counts', () => {
    const answer = (uuid: string, usage?: Record<string, number>) => ({
      ...assistant(uuid, [{ type: 'text', text: 'Ok.' }]),
      message: {
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: 'Ok.' }],
        ...(usage ? { usage } : {}),
      },
    });
    const turns = toTurns([
      user('u1', 'One'),
      answer('a1', { input_tokens: 10, cache_read_input_tokens: 30_000, output_tokens: 90 }),
      answer('a2', {
        input_tokens: 4,
        cache_creation_input_tokens: 1_000,
        cache_read_input_tokens: 31_000,
        output_tokens: 200,
      }),
      user('u2', 'Two'),
      answer('a3'),
    ]);
    expect(turns.map((turn) => turn.contextTokens)).toEqual([32_004, null]);
  });
});

describe('the queue', () => {
  const working = [JSON.stringify(user('u1', 'Fix it'))];
  const settled = (uuid: string) =>
    JSON.stringify(assistant(uuid, [{ type: 'text', text: 'Fixed.' }]));

  it('sends at once while the agent is free, and holds what is written while it works', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.post('Hello');
    vi.runAllTimers();
    expect(typed).toEqual(['Hello', '\r']);

    typed.length = 0;
    chat.apply({ reset: true, entries: working });
    chat.post('Then run the tests');
    chat.post('And open a PR');
    vi.runAllTimers();
    expect(typed).toEqual([]);
    expect(chat.snapshot().queued.map((queued) => queued.text)).toEqual([
      'Then run the tests',
      'And open a PR',
    ]);

    // The turn ends: the first goes; the second waits for the first's turn.
    chat.apply({ entries: [settled('a1')] });
    vi.advanceTimersByTime(100);
    expect(typed).toEqual(['Then run the tests', '\r']);
    expect(chat.snapshot().queued.map((queued) => queued.text)).toEqual(['And open a PR']);
    chat.apply({ entries: [JSON.stringify(user('u2', 'Then run the tests'))] });
    chat.apply({ entries: [settled('a2')] });
    vi.advanceTimersByTime(100);
    expect(typed).toEqual(['Then run the tests', '\r', 'And open a PR', '\r']);
    expect(chat.snapshot().queued).toEqual([]);
    vi.useRealTimers();
  });

  it('lets a queued message be sent now, or taken back to edit or drop', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: working });
    chat.post('One');
    chat.post('Two');
    const [one, two] = chat.snapshot().queued;

    expect(chat.unqueue(two?.id ?? '')).toBe('Two');
    expect(chat.unqueue(two?.id ?? '')).toBeNull();
    chat.sendQueued(one?.id ?? '');
    vi.runAllTimers();
    expect(typed).toEqual(['One', '\r']);
    expect(chat.snapshot().queued).toEqual([]);
    vi.useRealTimers();
  });

  it('does not let a message that opens no turn hold the rest', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: working });
    chat.post('/clear');
    chat.post('Go on');
    chat.apply({ entries: [settled('a1')] });
    vi.advanceTimersByTime(100);
    expect(typed).toEqual(['/clear', '\r']);
    vi.advanceTimersByTime(5_000);
    expect(typed).toEqual(['/clear', '\r', 'Go on', '\r']);
    vi.useRealTimers();
  });

  it('reads a command the CLI answered itself as a turn that ended, so the queue goes on', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: working });
    chat.post('/cost');
    chat.post('Go on');
    chat.apply({ entries: [settled('a1')] });
    vi.advanceTimersByTime(100);
    expect(typed).toEqual(['/cost', '\r']);
    chat.apply({
      entries: [
        JSON.stringify(
          user('c1', '<command-name>/cost</command-name>\n<command-args></command-args>'),
        ),
        JSON.stringify(
          user('c2', '<local-command-stdout>Total cost: $0.42</local-command-stdout>'),
        ),
      ],
    });
    expect(chat.snapshot().turns.at(-1)).toMatchObject({
      prompt: { text: '/cost' },
      working: false,
    });
    vi.advanceTimersByTime(100);
    expect(typed).toEqual(['/cost', '\r', 'Go on', '\r']);
    vi.useRealTimers();
  });

  it('waits for a reconnect to replay the turn it was written during before sending', () => {
    vi.useFakeTimers();
    const chat = new SessionChat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    const earlier = [JSON.stringify(user('u0', 'Look first')), settled('a0')];
    chat.apply({ reset: true, entries: [...earlier, ...working] });
    chat.post('Then ship it');
    // The history comes back in parts: the first ends on an older, settled turn.
    chat.apply({ reset: true, entries: earlier });
    vi.advanceTimersByTime(6_000);
    chat.apply({ entries: working });
    vi.advanceTimersByTime(6_000);
    expect(typed).toEqual([]);
    chat.apply({ entries: [settled('a1')] });
    vi.advanceTimersByTime(100);
    expect(typed).toEqual(['Then ship it', '\r']);
    vi.useRealTimers();
  });
});

describe('the status line’s figures', () => {
  const status = (fiveHour: number) =>
    JSON.stringify({
      type: 'oppenheimer.status',
      context_window: { used_percentage: 32, context_window_size: 200_000 },
      rate_limits: {
        five_hour: { used_percentage: fiveHour, resets_at: 1_793_040_000 },
        seven_day: { used_percentage: 41.2 },
      },
    });

  it('keeps the latest status apart from the conversation, through a reset', () => {
    const chat = new SessionChat();
    chat.apply({ reset: true, entries: [JSON.stringify(user('u1', 'Go')), status(10)] });
    chat.apply({ entries: [status(23.5)] });
    const state = chat.snapshot();
    expect(state.turns).toHaveLength(1);
    expect(state.status).toEqual({
      context: { usedPercent: 32, window: 200_000 },
      fiveHour: { usedPercent: 23.5, resetsAt: new Date(1_793_040_000_000) },
      sevenDay: { usedPercent: 41.2, resetsAt: null },
    });
    chat.apply({ reset: true, entries: [JSON.stringify(user('u1', 'Go'))] });
    expect(chat.snapshot().status?.fiveHour?.usedPercent).toBe(23.5);
  });

  it('reads an account with no plan windows as having none', () => {
    const chat = new SessionChat();
    chat.apply({
      reset: true,
      entries: [
        JSON.stringify({
          type: 'oppenheimer.status',
          context_window: { context_window_size: 200_000 },
        }),
      ],
    });
    expect(chat.snapshot().status).toEqual({ context: null, fiveHour: null, sevenDay: null });
  });
});

describe('files the agent shared', () => {
  const shared = (id: string, at: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      type: 'oppenheimer.file',
      id,
      timestamp: at,
      name: `${id}.png`,
      path: `/w/shots/${id}.png`,
      size: 2048,
      media_type: 'image/png',
      caption: 'The home page',
      preview: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
      ...extra,
    });
  const steps = (chat: SessionChat) =>
    chat.snapshot().turns.map((turn) => turn.steps.map((step) => step.kind));

  // The regression: a file the runner sends after the history (where every
  // shared entry comes) landing at the end of the latest turn instead of
  // where the agent shared it.
  it('places each file in its turn, between the steps written around it', () => {
    const chat = new SessionChat();
    chat.apply({
      reset: true,
      entries: [
        JSON.stringify(user('u1', 'Take a screenshot')),
        JSON.stringify(
          assistant('a1', [{ type: 'text', text: 'Taking it.' }], '2026-10-21T09:00:10.000Z'),
        ),
        JSON.stringify(
          assistant('a2', [{ type: 'text', text: 'Here it is.' }], '2026-10-21T09:00:30.000Z'),
        ),
        JSON.stringify(user('u2', 'Thanks', { timestamp: '2026-10-21T09:05:00.000Z' })),
        JSON.stringify(
          assistant('a3', [{ type: 'text', text: 'Welcome.' }], '2026-10-21T09:05:10.000Z'),
        ),
      ],
    });
    chat.apply({ entries: [shared('f1', '2026-10-21T09:00:20.000Z')] });
    expect(steps(chat)).toEqual([['reply', 'file', 'reply'], ['reply']]);
    const file = chat.snapshot().files[0];
    expect(file).toMatchObject({
      name: 'f1.png',
      caption: 'The home page',
      preview: 'data:image/jpeg;base64,AAAA',
    });
  });

  it('holds a file once, though every attachment sends it again', () => {
    const chat = new SessionChat();
    const history = [JSON.stringify(user('u1', 'Go'))];
    chat.apply({ reset: true, entries: [...history, shared('f1', '2026-10-21T09:00:05.000Z')] });
    chat.apply({ reset: true, entries: [...history, shared('f1', '2026-10-21T09:00:05.000Z')] });
    expect(chat.snapshot().files).toHaveLength(1);
    expect(steps(chat)).toEqual([['file']]);
  });

  it('shows no preview the host did not send as a JPEG', () => {
    const chat = new SessionChat();
    chat.apply({
      reset: true,
      entries: [
        JSON.stringify(user('u1', 'Go')),
        shared('f1', '2026-10-21T09:00:05.000Z', {
          preview: { type: 'base64', media_type: 'image/svg+xml', data: 'PHN2Zz4=' },
        }),
      ],
    });
    expect(chat.snapshot().files[0]?.preview).toBeNull();
  });
});

describe('a chat kept for the next pane', () => {
  const lines = Array.from({ length: 60 }, (_, i) => JSON.stringify(user(`u${i}`, `Prompt ${i}`)));

  it('keeps every line held when its pane goes in the middle of a replay', () => {
    // What breaks this: the replay's quiet, still armed once the stream that
    // fed it is gone, taken for a transcript that got shorter, so the chat
    // comes back cut to the lines the dead stream had sent again.
    vi.useFakeTimers();
    const chat = new SessionChat();
    chat.apply({ reset: true, history: 'end', entries: lines });
    chat.apply({ reset: true, history: 'more', entries: lines.slice(0, 20) });
    chat.detach();
    vi.advanceTimersByTime(20_000);
    expect(chat.snapshot().turns).toHaveLength(60);

    // The next pane's replay matches what is held and changes nothing.
    const before = chat.snapshot().turns;
    chat.apply({ reset: true, history: 'more', entries: lines.slice(0, 30) });
    chat.apply({ history: 'end', entries: lines.slice(30) });
    expect(chat.snapshot().turns).toBe(before);
    vi.useRealTimers();
  });

  it('drops a first load its pane left before it all came, so the next one loads it whole', () => {
    // What breaks this: the quiet ending a first load with half its history,
    // and that half kept and drawn on the next visit as the conversation.
    vi.useFakeTimers();
    const chat = new SessionChat();
    chat.apply({ reset: true, history: 'more', entries: lines.slice(0, 20) });
    chat.detach();
    vi.advanceTimersByTime(20_000);
    expect(chat.snapshot()).toMatchObject({ loading: false, available: false, turns: [] });

    chat.apply({ reset: true, history: 'more', entries: lines.slice(0, 20) });
    expect(chat.snapshot()).toMatchObject({ loading: true, turns: [] });
    chat.apply({ history: 'end', entries: lines.slice(20) });
    expect(chat.snapshot().turns).toHaveLength(60);
    vi.useRealTimers();
  });

  it('never types a message queued in one visit into a later one', () => {
    // What breaks this: the queue kept with the chat, so the next pane's
    // input sends it once the turn it waited on ends, with nobody watching.
    vi.useFakeTimers();
    const chat = new SessionChat();
    const first: string[] = [];
    const release = chat.connect((data) => first.push(data));
    const working = JSON.stringify(user('w1', 'Fix it'));
    chat.apply({ reset: true, history: 'end', entries: [working] });
    chat.post('Queued on the first visit');
    release();
    chat.detach();
    expect(chat.snapshot().queued).toEqual([]);

    const second: string[] = [];
    chat.connect((data) => second.push(data));
    chat.apply({ reset: true, history: 'end', entries: [working] });
    chat.apply({
      entries: [JSON.stringify(assistant('a1', [{ type: 'text', text: 'Fixed.' }]))],
    });
    vi.runAllTimers();
    expect([...first, ...second]).toEqual([]);
    vi.useRealTimers();
  });
});

describe('a conversation sent tail first', () => {
  // Each turn a prompt and a reply, as the runner sends them.
  const turn = (n: number) => [
    JSON.stringify(user(`u${n}`, `Prompt ${n}`)),
    JSON.stringify(assistant(`a${n}`, [{ type: 'text', text: `Reply ${n}` }])),
  ];
  const turns = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, i) => turn(from + i)).flat();
  const prompts = (chat: SessionChat) =>
    chat.snapshot().turns.map((each) => each.prompt?.text ?? '(none)');

  it('draws the tail at once and asks the host for the turns before it, a page at a time', () => {
    // What breaks this: a tail taken for the whole conversation, so the
    // reader reaching its top is never offered the rest; or a page put after
    // what is held instead of before it.
    const chat = new SessionChat();
    const asked: number[] = [];
    chat.connect(
      () => {},
      (before) => asked.push(before),
    );
    chat.apply({ reset: true, history: 'end', before: 900, entries: turns(60, 100) });
    expect(chat.snapshot()).toMatchObject({ loading: false, older: 'more' });
    expect(prompts(chat)).toHaveLength(40);

    expect(chat.loadOlder()).toBe(true);
    expect(asked).toEqual([900]);
    expect(chat.snapshot().older).toBe('loading');
    // Asked once until the page is there.
    expect(chat.loadOlder()).toBe(false);

    chat.apply({ older: 'more', entries: turns(20, 40) });
    expect(prompts(chat)).toHaveLength(40);
    chat.apply({ older: 'end', before: 300, entries: turns(40, 60) });
    expect(chat.snapshot().older).toBe('more');
    expect(prompts(chat)[0]).toBe('Prompt 20');
    expect(prompts(chat)).toHaveLength(80);

    chat.loadOlder();
    expect(asked).toEqual([900, 300]);
    chat.apply({ older: 'end', before: 0, entries: turns(0, 20) });
    expect(chat.snapshot().older).toBe('none');
    expect(prompts(chat)[0]).toBe('Prompt 0');
    expect(chat.loadOlder()).toBe(false);
  });

  it('keeps what it holds, older pages too, when a reconnect sends the tail again', () => {
    // What breaks this: a tail's replay checked from the first line held,
    // so it differs at once and the conversation is cut to the tail, older
    // pages and all, on every reconnect.
    const chat = new SessionChat();
    chat.connect(
      () => {},
      () => {},
    );
    chat.apply({ reset: true, history: 'end', before: 900, entries: turns(60, 100) });
    chat.loadOlder();
    chat.apply({ older: 'end', before: 300, entries: turns(20, 60) });
    const before = chat.snapshot().turns;

    // The conversation grew by a turn; the new tail starts a turn later.
    chat.apply({ reset: true, history: 'more', before: 930, entries: turns(61, 80) });
    chat.apply({ history: 'end', entries: turns(80, 101) });
    expect(prompts(chat)[0]).toBe('Prompt 20');
    expect(prompts(chat)).toHaveLength(81);
    expect(chat.snapshot().turns.slice(0, 80)).toEqual(before);
    expect(chat.snapshot().older).toBe('more');
    chat.loadOlder();
  });

  it('draws a tail it cannot find among what it holds as a conversation of its own', () => {
    const chat = new SessionChat();
    chat.apply({ reset: true, history: 'end', entries: turns(0, 10) });
    chat.apply({ reset: true, history: 'end', before: 5000, entries: turns(500, 510) });
    expect(prompts(chat)).toEqual(Array.from({ length: 10 }, (_, i) => `Prompt ${500 + i}`));
    expect(chat.snapshot().older).toBe('more');
  });

  it('lets go of a page asked of an attachment that is gone', () => {
    // What breaks this: the page's lines held across the new attachment's
    // reset, then put before a conversation they no longer precede.
    const asked: number[] = [];
    const chat = new SessionChat();
    chat.connect(
      () => {},
      (before) => asked.push(before),
    );
    chat.apply({ reset: true, history: 'end', before: 900, entries: turns(60, 100) });
    chat.loadOlder();
    chat.apply({ older: 'more', entries: turns(20, 40) });
    chat.apply({ reset: true, history: 'end', before: 900, entries: turns(60, 100) });
    expect(chat.snapshot().older).toBe('more');
    chat.apply({ older: 'end', before: 300, entries: turns(40, 60) });
    expect(prompts(chat)[0]).toBe('Prompt 60');
    expect(chat.loadOlder()).toBe(true);
    expect(asked).toEqual([900, 900]);
  });

  it('asks nothing of a host that sent the whole conversation', () => {
    const chat = new SessionChat();
    const asked: number[] = [];
    chat.connect(
      () => {},
      (before) => asked.push(before),
    );
    chat.apply({ reset: true, history: 'end', entries: turns(0, 50) });
    expect(chat.snapshot().older).toBe('none');
    expect(chat.loadOlder()).toBe(false);
    expect(asked).toEqual([]);
  });
});

describe('SessionChat.connect', () => {
  it('keeps what the connection lent now says when an earlier one is given back', () => {
    const chat = new SessionChat();
    const releaseFirst = chat.connect(() => {}, undefined, { interruptible: false });
    chat.connect(() => {}, undefined, { interruptible: false });
    // Breaks if giving back a connection the chat no longer holds resets
    // whether the current source can stop a turn.
    releaseFirst();
    expect(chat.snapshot().interruptible).toBe(false);
  });
});
