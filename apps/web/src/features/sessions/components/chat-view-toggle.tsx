import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { SessionView } from '../lib/chat-blocks';

/** Terminal / Chat, first in a session terminal's status bar once the chat is offered. */
export function ChatViewToggle({
  view,
  onViewChange,
}: {
  view: SessionView;
  onViewChange: (view: SessionView) => void;
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      value={view}
      onValueChange={(next) => onViewChange(next === 'chat' ? 'chat' : 'terminal')}
      aria-label={t('sessions.chat.view.label')}
    >
      <SegmentedControlItem value="terminal">
        {t('sessions.chat.view.terminal')}
      </SegmentedControlItem>
      <SegmentedControlItem value="chat">{t('sessions.chat.view.chat')}</SegmentedControlItem>
    </SegmentedControl>
  );
}
