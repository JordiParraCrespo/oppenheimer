import { IconButton } from '@oppenheimer/design-system-web';
import { PanelRightIcon } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The session bar's side pane toggle: the panel-right icon, lit while the
 * side pane is open beside the terminal.
 */
export function PreviewToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <IconButton
      size="sm"
      aria-label={open ? t('sessions.side.hide') : t('sessions.side.show')}
      aria-pressed={open}
      data-dirty={open ? '' : undefined}
      onClick={onToggle}
    >
      <PanelRightIcon />
    </IconButton>
  );
}
