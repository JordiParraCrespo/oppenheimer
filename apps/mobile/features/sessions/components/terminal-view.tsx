import { useStickToBottom } from '@oppenheimer/frontend-mobile';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTerminalSnapshot } from '../hooks/use-terminal-snapshot';
import { type TerminalScheme, terminalGround } from '../lib/terminal-palette';
import type { TerminalScreen } from '../lib/terminal-screen';
import {
  TERMINAL_FONT,
  TERMINAL_FONT_SIZE,
  TERMINAL_LINE_HEIGHT,
  TerminalLine,
} from './terminal-line';

/** Ten of the widest glyph, measured once, to know how many columns fit. */
const RULER = 'MMMMMMMMMM';
const GUTTER = 16;

/**
 * The agent's terminal as the phone draws it: its lines in the console's
 * terminal ramp, following the newest output while the reader is at the
 * foot (scrolled up, they are left where they are). It measures how many columns
 * and rows fit and hands that up (`onSize`), which is what resizes the
 * host's window: only this view does, so reading the chat never reflows the
 * terminal on the computer.
 */
export function TerminalView({
  screen,
  scheme,
  bottomInset,
  label,
  onSize,
}: {
  screen: TerminalScreen;
  scheme: TerminalScheme;
  /** Room the dock covers at the foot, kept clear under the last line. */
  bottomInset: number;
  label: string;
  onSize: (cols: number, rows: number) => void;
}) {
  const { lines } = useTerminalSnapshot(screen);
  const stick = useStickToBottom();
  const box = useRef<{ width: number; height: number } | null>(null);
  const [charWidth, setCharWidth] = useState<number | null>(null);
  const ground = terminalGround(scheme);

  const fitGrid = (glyph: number | null) => {
    if (!glyph || !box.current) return;
    const cols = Math.max(20, Math.floor((box.current.width - GUTTER * 2) / glyph));
    const rows = Math.max(8, Math.floor((box.current.height - bottomInset) / TERMINAL_LINE_HEIGHT));
    onSize(cols, rows);
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: ground.bg }}
      onLayout={(event) => {
        box.current = event.nativeEvent.layout;
        fitGrid(charWidth);
      }}
    >
      <Text
        className="absolute opacity-0"
        style={{ fontFamily: TERMINAL_FONT, fontSize: TERMINAL_FONT_SIZE }}
        onTextLayout={(event) => {
          const width = event.nativeEvent.lines[0]?.width;
          if (!width) return;
          setCharWidth(width / RULER.length);
          fitGrid(width / RULER.length);
        }}
        accessible={false}
      >
        {RULER}
      </Text>
      <ScrollView
        {...stick}
        contentContainerStyle={{ padding: GUTTER, paddingBottom: bottomInset + GUTTER }}
        accessibilityLabel={label}
      >
        {lines.map((line) => (
          <TerminalLine key={line.index} line={line} scheme={scheme} ink={ground.fg} />
        ))}
      </ScrollView>
    </View>
  );
}
