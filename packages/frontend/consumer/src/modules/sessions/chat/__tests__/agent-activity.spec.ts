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

  it('reads nothing off a settled screen or a line of output that only starts with a star, so a done turn is not shown working', () => {
    expect(readAgentActivity(screen('✻ Worked for 4m 31s'))).toBeNull();
    expect(readAgentActivity(screen('* Building… (see the log above)'))).toBeNull();
  });
});
