import { TerminalPrompt } from '@oppenheimer/design-system-web';
import { useState } from 'react';

/**
 * The input row under a terminal: a line written at leisure and sent to the
 * agent on Enter, as if typed at its prompt. It keeps the half-typed line, so
 * a keystroke re-renders this row and never the terminal above it. The
 * terminal's host link locks it (offline, catching up) and says why.
 */
export function TerminalComposer({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <TerminalPrompt
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        const text = value.trim();
        if (!text) return;
        onSubmit(text);
        setValue('');
      }}
    />
  );
}
