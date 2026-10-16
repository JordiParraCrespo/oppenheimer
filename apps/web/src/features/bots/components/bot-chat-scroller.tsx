import { FloatingChip } from '@oppenheimer/design-system-web';
import { ChevronDown } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useStickToBottom } from '@/features/bots/hooks/use-stick-to-bottom';

/**
 * The chat's scrolling pane: it follows the latest line while you are at the
 * bottom, and when you scroll up to read, a round chevron floats over its
 * foot, just above the composer, to take you back (the Bots frame). Whether
 * you are at the bottom is its state alone: the transcript is its parent's
 * element, so scrolling redraws the button and nothing in the chat.
 */
export function BotChatScroller({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { scroller, content, atLatest, toLatest } = useStickToBottom();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pt-7 pb-10">
        <div ref={content}>{children}</div>
      </div>
      {atLatest ? null : (
        <FloatingChip
          variant="round"
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
          aria-label={t('bots.chat.toLatest')}
          title={t('bots.chat.toLatest')}
          onClick={toLatest}
        >
          <ChevronDown aria-hidden />
        </FloatingChip>
      )}
    </div>
  );
}
