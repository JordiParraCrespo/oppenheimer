import { TaskComposer } from '@oppenheimer/design-system-web';
import type { ComponentProps } from 'react';
import { useState } from 'react';

/**
 * A column's quick add with its own draft, so a keystroke redraws the
 * composer and not the board's cards. A submit clears it for the next title.
 */
export function ColumnComposer({
  onSubmit,
  ...props
}: Omit<ComponentProps<typeof TaskComposer>, 'value' | 'onValueChange'>) {
  const [draft, setDraft] = useState('');
  return (
    <TaskComposer
      {...props}
      value={draft}
      onValueChange={setDraft}
      onSubmit={(title) => {
        onSubmit(title);
        setDraft('');
      }}
    />
  );
}
