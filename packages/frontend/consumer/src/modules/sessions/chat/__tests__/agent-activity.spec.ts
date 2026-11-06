// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readAgentActivity } from '../agent-activity';

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

  it('reads nothing off a settled screen or a line of output that only starts with a star, so a done turn is not shown working', () => {
    expect(readAgentActivity(screen('✻ Worked for 4m 31s'))).toBeNull();
    expect(readAgentActivity(screen('* Building… (see the log above)'))).toBeNull();
  });
});
