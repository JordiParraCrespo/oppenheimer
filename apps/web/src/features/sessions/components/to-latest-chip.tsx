import { FloatingChip } from '@oppenheimer/design-system-web';
import { ArrowDown } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * Jump to latest, at the foot of a pane the reader scrolled back through: the
 * chat above its newest turn, or a watcher's terminal on a page of its
 * scrollback. It fades the lines under it into the terminal's ground, and
 * keeps the console's face over a monospace grid.
 */
export function ToLatestChip({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-chat-ground via-chat-ground/85 to-transparent pt-12 pb-3 font-sans">
      <FloatingChip className="pointer-events-auto" onClick={onClick}>
        <ArrowDown />
        {t('sessions.chat.latest')}
      </FloatingChip>
    </div>
  );
}
