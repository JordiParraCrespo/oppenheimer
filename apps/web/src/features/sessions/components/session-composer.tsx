import { TerminalPrompt } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The pinned prompt row of `product/versions/mvp/design/version1`.
 *
 * It posts a whole line, which is the one thing a box is better at than the
 * grid: a paragraph of instruction for the agent, written without a stray
 * Ctrl-C losing it. It cannot replace the grid — a line at a time sends no
 * Ctrl-C, no arrow keys and no tab completion — so it sits beside it, and
 * focus returns to the grid once the line is away.
 *
 * The draft lives here, the lowest component that reads it, so typing does
 * not re-render the terminal above.
 */
export function SessionComposer({ onSubmit }: { onSubmit: (text: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  return (
    <TerminalPrompt
      value={draft}
      placeholder={t('sessions.session.composerPlaceholder')}
      aria-label={t('sessions.session.composerPlaceholder')}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        const text = draft.trim();
        if (!text) return;
        onSubmit(text);
        setDraft('');
      }}
    />
  );
}
