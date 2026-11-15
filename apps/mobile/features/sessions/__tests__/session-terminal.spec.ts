import { describe, expect, it } from 'vitest';
import { permissionAnswer, questionAnswer } from '../lib/decision-answer';
import { withCtrl } from '../lib/terminal-keys';
import { terminalColour } from '../lib/terminal-palette';
import { TerminalScreen } from '../lib/terminal-screen';

/**
 * The session screen's pure parts. What breaks if they drift: the terminal
 * shows escape codes or loses its colours, ctrl+letter types the letter, and
 * an answer goes to the API half-made or shaped as something it refuses.
 */
describe('the session screen', () => {
  it('reads a program’s output back as styled lines, without the escape codes', async () => {
    const screen = new TerminalScreen(40, 6);
    await new Promise<void>((done) =>
      screen.write('$ pnpm test\r\n\u001b[31m3 failed\u001b[0m, 41 passed', done),
    );
    const { lines } = screen.snapshot();
    expect(lines.map((line) => line.runs.map((run) => run.text).join(''))).toEqual([
      '$ pnpm test',
      '3 failed, 41 passed',
    ]);
    expect(lines[1]?.runs[0]).toMatchObject({ text: '3 failed', fg: 1 });
    screen.dispose();
  });

  it('colours the sixteen from the console’s ramp and the rest from xterm’s cube', () => {
    expect(terminalColour(1, 'dark')).toBe('#ff453a');
    expect(terminalColour(0, 'light')).toBe('#1d1d1f');
    expect(terminalColour(196, 'dark')).toBe('#ff0000');
    expect(terminalColour(232, 'dark')).toBe('#080808');
    expect(terminalColour(null, 'dark')).toBeNull();
  });

  it('turns a letter into its control code while ctrl is held', () => {
    expect(withCtrl('c')).toBe('\u0003');
    expect(withCtrl('D')).toBe('\u0004');
    expect(withCtrl('1')).toBe('1');
  });

  it('answers every question with its picks, and nothing while one has none', () => {
    const decision = {
      kind: 'question' as const,
      id: 'q',
      questions: [
        {
          header: null,
          question: 'Which?',
          multiSelect: false,
          options: [{ label: 'A', description: null }],
        },
        {
          header: null,
          question: 'And?',
          multiSelect: true,
          options: [{ label: 'B', description: null }],
        },
      ],
    };
    expect(questionAnswer(decision, [[0], []])).toBeNull();
    expect(questionAnswer(decision, [[0], [0, 1]])).toEqual({
      id: 'q',
      answers: [
        { picks: [0], other: null },
        { picks: [0, 1], other: null },
      ],
    });
    expect(permissionAnswer('p', 1)).toEqual({ id: 'p', option: 1 });
  });
});
