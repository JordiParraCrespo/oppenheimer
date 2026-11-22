import type { ReactNode, Ref } from 'react';
import { useEmojiMenu } from '../hooks/use-emoji-menu';
import { ComposerEmojiMenu } from './composer-emoji-menu';

/**
 * The box a composer sits in, with its `:` menu (`useEmojiMenu`): the menu
 * opens over the shortcode being typed in the field inside, and takes the
 * field's keys while it is open. Anything else that opens over the composer
 * (a `/` menu) goes in as a child beside it.
 */
export function ComposerEmojiBox({
  draft,
  setDraft,
  ref,
  children,
}: {
  draft: string;
  setDraft: (next: string) => void;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const emoji = useEmojiMenu(draft, setDraft);
  return (
    <div ref={ref} className="relative" onKeyDownCapture={emoji.onKeyDownCapture} {...emoji.track}>
      {emoji.rows ? (
        <ComposerEmojiMenu
          rows={emoji.rows}
          left={emoji.left}
          highlighted={emoji.highlighted}
          onPick={emoji.pick}
        />
      ) : null}
      {children}
    </div>
  );
}
