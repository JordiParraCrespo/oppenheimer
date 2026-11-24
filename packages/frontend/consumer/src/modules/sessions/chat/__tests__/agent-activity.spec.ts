// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readAgentActivity, readCommandTail } from '../agent-activity';
import * as captured from './claude-screens';

/** A Claude Code screen's foot while it works: output, the spinner, the prompt box under it. */
function screen(spinner: string): string[] {
  return [
    '● Deployed at 0x6Fc5…6de3, precompile call works through it.',
    '',
    spinner,
    '',
    '────────────────────────────────────────',
    '> ',
    '────────────────────────────────────────',
    '  ⏵⏵ bypass permissions on (shift+tab to cycle)',
  ];
}

/** The spinner with a long todo list under it, as Claude Code draws it while it works through one. */
function screenWithTodos(spinner: string, todos: number): string[] {
  const list = Array.from({ length: todos }, (_, i) => `     ☐ Step ${i + 1} of the plan`);
  const [first = '', ...rest] = screen(spinner).slice(2);
  return ['● Working through the plan.', '', first, ...list, ...rest];
}

describe('readAgentActivity', () => {
  it("reads the word Claude Code picked and the counts beside it, so the chat says what the terminal's spinner says", () => {
    expect(
      readAgentActivity(
        screen('✻ Mustering… (4m 31s · ↓ 15.9k tokens · thinking some more with medium effort)'),
      ),
    ).toEqual({
      verb: 'Mustering',
      detail: '4m 31s · ↓ 15.9k tokens · thinking some more with medium effort',
    });
  });

  it('keeps a task’s own words and drops the interrupt hint, which means nothing in the chat', () => {
    expect(
      readAgentActivity(screen('✢ Running the tests… (12s · ↑ 1.2k tokens · esc to interrupt)')),
    ).toEqual({ verb: 'Running the tests', detail: '12s · ↑ 1.2k tokens' });
  });

  it('finds the spinner above a long todo list, so a multi-step turn keeps its line', () => {
    expect(
      readAgentActivity(screenWithTodos('✶ Implementing… (2m 3s · ↓ 4.1k tokens)', 14)),
    ).toEqual({ verb: 'Implementing', detail: '2m 3s · ↓ 4.1k tokens' });
  });

  it('reads a spinner line a narrow screen wrapped or cut short, so a phone shows it too', () => {
    expect(
      readAgentActivity([
        '✻ Mustering… (4m 31s · ↓ 15.9k tokens · thinking',
        'some more with medium effort)',
        '',
        '> ',
      ]),
    ).toEqual({
      verb: 'Mustering',
      detail: '4m 31s · ↓ 15.9k tokens · thinking some more with medium effort',
    });
    expect(
      readAgentActivity(['✻ Mustering… (4m 31s · ↓ 15.9k tok', '     ☐ Step 1 of the plan', '> ']),
    ).toEqual({
      verb: 'Mustering',
      detail: '4m 31s · ↓ 15.9k tok',
    });
  });

  it('reads nothing when Claude stopped under its spinner to ask, so a waiting agent is not shown working', () => {
    expect(
      readAgentActivity([
        '✻ Editing src/main.go… (18s · esc to interrupt)',
        '',
        'Do you want to proceed?',
        '❯ 1. Yes',
        '  2. No',
      ]),
    ).toBeNull();
    expect(
      readAgentActivity([
        '✻ Editing… (18s · ↓ 1k tokens)',
        ' Do you want to make this edit to src/app.ts?',
        ' ❯ 1. Yes',
      ]),
    ).toBeNull();
  });

  it('reads nothing off a settled screen or a line of output that only starts with a star, so a done turn is not shown working', () => {
    expect(readAgentActivity(screen('✻ Worked for 4m 31s'))).toBeNull();
    expect(readAgentActivity(screen('* Building… (see the log above)'))).toBeNull();
  });
});

describe('the running command’s tail', () => {
  it('reads the last lines a running command printed under its call, so the chat shows them before the result lands', () => {
    expect(readAgentActivity(captured.running)?.tail).toEqual({
      command: './build.sh',
      lines: [
        'building step 19 of 40: compiling module_19.ts',
        'building step 20 of 40: compiling module_20.ts',
        'building step 21 of 40: compiling module_21.ts',
      ],
    });
  });

  it('keeps the rows as a narrow screen wrapped them, a leading space of the output included', () => {
    expect(readAgentActivity(captured.runningNarrow)?.tail?.lines).toEqual([
      ' PASS',
      'src/modules/sessions/chat/__tests__/agent-activity-number-5.spec.ts',
      '(12 tests) 35ms',
    ]);
  });

  it('reads the running call, not a finished one above it, nor the tip under the spinner', () => {
    expect(readAgentActivity(captured.runningUnderDone)?.tail?.lines).toEqual([
      ' PASS',
      'src/modules/sessions/chat/__tests__/agent-activity-number-5.spec.ts',
      '(12 tests) 35ms',
    ]);
  });

  it('reads a command that printed nothing yet as running with no lines, so no “Running…” reaches the chat', () => {
    expect(readAgentActivity(captured.runningNoOutput)?.tail).toEqual({
      command: './test.sh',
      lines: [],
    });
  });

  it('reads no tail where the screen shows none: the fullscreen renderer, a finished turn, a stopped one', () => {
    const fullscreen = readAgentActivity(captured.fullscreenRunning);
    expect(fullscreen?.verb).toBe('Ideating');
    expect(fullscreen?.tail).toBeUndefined();
    expect(readAgentActivity(captured.done)).toBeNull();
    expect(readAgentActivity(captured.interrupted)).toBeNull();
    expect(readCommandTail(captured.done)).toBeNull();
  });

  it('cuts a long line at its front, so the tail holds the end a person reads', () => {
    const tail = readCommandTail(['● Bash(make)', `  ⎿  ${'x'.repeat(900)}`, '     (4s)']);
    expect(tail?.lines).toHaveLength(1);
    expect(Array.from(tail?.lines[0] ?? '')).toHaveLength(600);
    expect(tail?.lines[0]?.startsWith('…')).toBe(true);
  });
});
