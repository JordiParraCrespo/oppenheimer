import { IconButton } from '@oppenheimer/design-system-web';
import { Wrench } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The wrench in a bot chat's bar that shows or hides the tool calls in the
 * transcript, and the routine runs that did nothing else; lit while they are
 * shown. Props in, choice out.
 */
export function ToolCallsToggle({
  shown,
  onShownChange,
}: {
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}) {
  const { t } = useTranslation();
  const label = shown ? t('bots.chat.hideToolCalls') : t('bots.chat.showToolCalls');
  return (
    <IconButton
      size="sm"
      variant="quiet"
      aria-label={label}
      title={label}
      aria-pressed={shown}
      data-dirty={shown ? '' : undefined}
      onClick={() => onShownChange(!shown)}
    >
      <Wrench />
    </IconButton>
  );
}
