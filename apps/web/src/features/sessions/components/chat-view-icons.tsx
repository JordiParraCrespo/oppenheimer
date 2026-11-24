import { IconButton } from '@oppenheimer/design-system-web';
import { MessageSquareIcon, SquareTerminalIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import type { SessionView } from '../lib/chat-blocks';

/**
 * Terminal / Chat in the session's bar: two square icons on one soft pill,
 * so they read as one switch apart from the bar's other buttons, the view on
 * screen lit, each named by its tooltip. The pill stands on the small rung,
 * as tall as the buttons beside it, so its icons are the next size down. A terminal's status line, with no
 * room for a tooltip to explain a glyph, keeps the worded `ChatViewToggle`.
 */
export function ChatViewIcons({
  view,
  onViewChange,
}: {
  view: SessionView;
  onViewChange: (view: SessionView) => void;
}) {
  const { t } = useTranslation();
  const views = [
    { value: 'terminal', Icon: SquareTerminalIcon },
    { value: 'chat', Icon: MessageSquareIcon },
  ] as const;
  return (
    <fieldset
      aria-label={t('sessions.chat.view.label')}
      className="m-0 flex gap-0.5 rounded-sm border-0 bg-hover-surface p-0.5"
    >
      {views.map(({ value, Icon }) => (
        <IconButton
          key={value}
          size="xs"
          shape="square"
          aria-label={t(`sessions.chat.view.${value}`)}
          title={t(`sessions.chat.view.${value}`)}
          aria-pressed={view === value}
          data-dirty={view === value ? '' : undefined}
          className="data-dirty:bg-card"
          onClick={() => onViewChange(value)}
        >
          <Icon className="size-3.5" />
        </IconButton>
      ))}
    </fieldset>
  );
}
