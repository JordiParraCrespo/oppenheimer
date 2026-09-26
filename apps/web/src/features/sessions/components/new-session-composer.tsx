import { Composer } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The composer of New session: the first task, and the foot row of controls
 * that says how it will be run.
 *
 * **The task's text lives here**, in the lowest component that reads it. That
 * is the point of this file existing at all: the sections above hold the chips
 * and the lists they draw, and text held up there would re-render the host
 * chip, the repository picker and the branch pane on every keystroke. What
 * leaves this component is the finished sentence, once.
 *
 * `scope` is the band over the field and `tools` and `engine` are the foot
 * row's two slots — where the work happens on top, scope of action on the
 * left, who drives it on the right — and they are passed in rather than built
 * here because each is a chip bound to the New session draft's store.
 */
export function NewSessionComposer({
  onSubmit,
  busy,
  disabled,
  scope,
  tools,
  engine,
}: {
  onSubmit: (text: string) => void;
  busy?: boolean;
  disabled?: boolean;
  /** The scope chips, in the band fused to the top of the field. */
  scope?: ReactNode;
  tools?: ReactNode;
  engine?: ReactNode;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  return (
    <Composer
      value={draft}
      onValueChange={setDraft}
      busy={busy}
      disabled={disabled}
      placeholder={t('sessions.new.composer.placeholder')}
      scope={scope}
      tools={tools}
      engine={engine}
      onSubmit={(text) => {
        const task = text.trim();
        if (!task) return;
        onSubmit(task);
        // Deliberately not cleared. A successful submit navigates to the new
        // session and this unmounts with it; a failed one leaves the sentence
        // where its author can fix it and send it again, which is the whole
        // reason not to clear on the way out.
      }}
    />
  );
}
