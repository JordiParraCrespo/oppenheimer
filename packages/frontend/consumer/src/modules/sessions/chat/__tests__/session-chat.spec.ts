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
        { type: 'tool_use', id: 'w', name: 'Write', input: { file_path: 'b.ts', content: '1\n2' } },
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
    expect(calls[2]?.todos).toEqual([
      { content: 'Read', status: 'completed' },
      { content: 'Fix', status: 'in_progress' },
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
      user('o', '<local-command-stdout>ok</local-command-stdout>'),
      { ...assistant('s', [{ type: 'text', text: 'subagent' }]), isSidechain: true },
      { type: 'attachment', attachment: {} },
      'not an object',
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.prompt?.text).toBe('/review 142');
    expect(turns[0]?.steps).toEqual([]);
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
    expect(chat.snapshot()).toEqual({ available: true, turns: [], queued: [], status: null });
    expect(before.turns).toHaveLength(2);
    expect(listener).toHaveBeenCalledTimes(3);
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
