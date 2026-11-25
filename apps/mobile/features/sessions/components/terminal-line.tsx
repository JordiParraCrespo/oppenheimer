import { Platform, Text } from 'react-native';
import { type TerminalScheme, terminalColour } from '../lib/terminal-palette';
import type { TerminalLine as Line } from '../lib/terminal-screen';

export const TERMINAL_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });
export const TERMINAL_FONT_SIZE = 12;
export const TERMINAL_LINE_HEIGHT = 17;

/**
 * One line of the terminal: its runs, each in its own colours and weight.
 * The colours are the program's, cell by cell, so they are style values
 * rather than classes.
 */
export function TerminalLine({
  line,
  scheme,
  ink,
}: {
  line: Line;
  scheme: TerminalScheme;
  /** The ramp's own ink, for a run in the default colour. */
  ink: string;
}) {
  return (
    <Text
      style={{
        fontFamily: TERMINAL_FONT,
        fontSize: TERMINAL_FONT_SIZE,
        lineHeight: TERMINAL_LINE_HEIGHT,
        color: ink,
      }}
    >
      {line.runs.length === 0
        ? ' '
        : line.runs.map((run, index) => (
            <Text
              // Runs are positional: a line is redrawn whole when it changes.
              // biome-ignore lint/suspicious/noArrayIndexKey: runs have no identity of their own
              key={index}
              style={{
                color: terminalColour(run.fg, scheme) ?? undefined,
                backgroundColor: terminalColour(run.bg, scheme) ?? undefined,
                fontWeight: run.bold ? '700' : undefined,
                opacity: run.dim ? 0.6 : undefined,
                fontStyle: run.italic ? 'italic' : undefined,
                textDecorationLine: run.underline ? 'underline' : undefined,
              }}
            >
              {run.text}
            </Text>
          ))}
    </Text>
  );
}
